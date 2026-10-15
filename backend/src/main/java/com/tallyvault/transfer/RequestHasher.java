package com.tallyvault.transfer;

import com.tallyvault.common.Money;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class RequestHasher {
    private RequestHasher() {}
    public static String transfer(TransferDtos.TransferRequest request) {
        String canonical = request.sourceAccountId() + "|" + request.destinationAccountId() + "|"
            + Money.requirePositive(request.amount()).toPlainString() + "|"
            + (request.reference() == null ? "" : request.reference().strip());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is not available", impossible);
        }
    }
}

