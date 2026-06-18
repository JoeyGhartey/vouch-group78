package com.vouch.payment.repository;

import com.vouch.payment.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    Optional<PaymentTransaction> findByReference(String reference);
    Optional<PaymentTransaction> findByPaystackReference(String paystackReference);
}
