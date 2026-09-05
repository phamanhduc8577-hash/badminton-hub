package com.smashflow.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class VietQrService {

    @Value("${vietqr.bank-id:MB}")
    private String bankId;

    @Value("${vietqr.account-no:0325872682}")
    private String accountNo;

    @Value("${vietqr.account-name:PHAM ANH DUC}")
    private String accountName;

    public String generateQrUrl(BigDecimal amount, String memo) {
        try {
            String encodedMemo = URLEncoder.encode(memo, StandardCharsets.UTF_8);
            String encodedAccountName = URLEncoder.encode(accountName, StandardCharsets.UTF_8);
            long amountLong = amount != null ? amount.longValue() : 20000L;

            return String.format(
                    "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=%s&accountName=%s",
                    bankId, accountNo, amountLong, encodedMemo, encodedAccountName
            );
        } catch (Exception e) {
            return "";
        }
    }
}
