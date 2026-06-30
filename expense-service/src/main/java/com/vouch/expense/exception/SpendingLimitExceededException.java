package com.vouch.expense.exception;

public class SpendingLimitExceededException extends RuntimeException {
    public SpendingLimitExceededException(String message) {
        super(message);
    }
}
