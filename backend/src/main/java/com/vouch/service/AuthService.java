package com.vouch.service;

import com.vouch.dto.AuthResponse;
import com.vouch.dto.LoginRequest;
import com.vouch.dto.RegisterRequest;
import com.vouch.entity.User;
import com.vouch.repository.UserRepository;
import com.vouch.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Phone number already registered");
        }

        User user = User.builder()
                .phone(request.getPhone())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .momoProvider(request.getMomoProvider())
                .momoNumber(request.getMomoNumber())
                .trustScore(50.0)
                .totalLoansGiven(0)
                .totalLoansReceived(0)
                .loansRepaidOnTime(0)
                .defaults(0)
                .borrowingSuspended(false)
                .permanentBan(false)
                .role(User.Role.USER)
                .build();

        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getPhone());

        return AuthResponse.builder()
                .token(token)
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .trustScore(user.getTrustScore())
                .message("Registration successful")
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        User user;

        if ("email".equals(request.getLoginMethod())) {
            // Look up by email, then authenticate using the phone (which Spring Security uses as username)
            user = userRepository.findByEmail(request.getIdentifier())
                    .orElseThrow(() -> new RuntimeException("No account found with this email address"));

            // Verify password manually since Spring Security uses phone as username
            if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                throw new RuntimeException("Invalid password");
            }
        } else {
            // Default: login by phone (original behaviour unchanged)
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getIdentifier(), request.getPassword())
            );
            user = userRepository.findByPhone(request.getIdentifier())
                    .orElseThrow(() -> new RuntimeException("No account found with this phone number"));
        }

        String token = jwtUtil.generateToken(user.getPhone());

        return AuthResponse.builder()
                .token(token)
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .trustScore(user.getTrustScore())
                .message("Login successful")
                .build();
    }
}