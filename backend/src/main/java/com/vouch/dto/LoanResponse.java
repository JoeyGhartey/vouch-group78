package com.vouch.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LoanResponse {
    private Long id;
    private String borrowerName;
    private Long borrowerId;
    private String lenderName;
    private Long lenderId;
    private String circleName;
    private Long circleId;
    private Double amount;
    private String reason;
    private Double interestRate;
    private Double totalRepaymentAmount;
    private Double amountRepaid;
    private Double overdueInterestAccrued;
    private String repaymentType;
    private Integer repaymentPeriodMonths;
    private String status;
    private Boolean isGroupFunded;
    private LocalDateTime dueDate;
    private LocalDateTime gracePeriodEnd;
    private LocalDateTime createdAt;
    private LocalDateTime disbursedAt;
    private String message;
}
