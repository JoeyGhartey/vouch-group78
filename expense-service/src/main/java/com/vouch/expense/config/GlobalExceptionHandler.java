package com.vouch.expense.config;

import org.springframework.http.HttpStatus; import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler; import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.time.LocalDateTime; import java.util.HashMap; import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(RuntimeException ex) {
        Map<String, Object> e = new HashMap<>(); e.put("timestamp", LocalDateTime.now()); e.put("status", 400); e.put("error", "Bad Request"); e.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e);
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, Object> e = new HashMap<>(); e.put("timestamp", LocalDateTime.now()); e.put("status", 400); e.put("error", "Validation Failed");
        Map<String, String> f = new HashMap<>(); for (FieldError fe : ex.getBindingResult().getFieldErrors()) f.put(fe.getField(), fe.getDefaultMessage()); e.put("messages", f);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e);
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        ex.printStackTrace(); Map<String, Object> e = new HashMap<>(); e.put("timestamp", LocalDateTime.now()); e.put("status", 500); e.put("error", "Internal Server Error"); e.put("message", "An unexpected error occurred.");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e);
    }
}
