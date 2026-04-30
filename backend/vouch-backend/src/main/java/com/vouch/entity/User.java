package com.vouch.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String phone;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    private String email;

    private String momoProvider;

    private String momoNumber;

    @Column(nullable = false)
    private Double trustScore = 50.0;

    @Column(nullable = false)
    private Integer totalLoansGiven = 0;

    @Column(nullable = false)
    private Integer totalLoansReceived = 0;

    @Column(nullable = false)
    private Integer loansRepaidOnTime = 0;

    @Column(nullable = false)
    private Integer defaults = 0;

    @Column(nullable = false)
    private Boolean borrowingSuspended = false;

    private LocalDateTime borrowingSuspendedUntil;

    @Column(nullable = false)
    private Boolean permanentBan = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.USER;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime lastActive;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        lastActive = LocalDateTime.now();
    }

    public enum Role {
        USER, ADMIN
    }
}
