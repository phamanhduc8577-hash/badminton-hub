package com.smashflow.service;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
@Getter
public class VietQrService {

    @Value("${vietqr.bank-id:${BANK_BIN:${BANK_NAME:MB}}}")
    private String bankId;

    @Value("${vietqr.account-no:${BANK_ACCOUNT:0325872682}}")
    private String accountNo;

    @Value("${vietqr.account-name:${BANK_OWNER:PHAM ANH DUC}}")
    private String accountName;

    /**
     * Dựng URL ảnh VietQR chuẩn img.vietqr.io
     */
    public String generateQrUrl(BigDecimal amount, String memo) {
        try {
            String encodedMemo = URLEncoder.encode(memo != null ? memo : "", StandardCharsets.UTF_8);
            String encodedAccountName = URLEncoder.encode(accountName != null ? accountName : "", StandardCharsets.UTF_8);
            long amountLong = amount != null ? amount.longValue() : 0L;

            return String.format(
                    "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=%s&accountName=%s",
                    bankId, accountNo, amountLong, encodedMemo, encodedAccountName
            );
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Dựng URL ảnh SePay QR (hỗ trợ hiển thị bổ sung hoặc fallback)
     * Format: https://qr.sepay.vn/img?acc={STK}&bank={BIN}&amount={VND}&des={NOI_DUNG}&template=compact
     */
    public String generateSepayQrUrl(BigDecimal amount, String memo) {
        try {
            String encodedMemo = URLEncoder.encode(memo != null ? memo : "", StandardCharsets.UTF_8);
            long amountLong = amount != null ? amount.longValue() : 0L;

            return String.format(
                    "https://qr.sepay.vn/img?acc=%s&bank=%s&amount=%d&des=%s&template=compact",
                    accountNo, bankId, amountLong, encodedMemo
            );
        } catch (Exception e) {
            return "";
        }
    }
}
