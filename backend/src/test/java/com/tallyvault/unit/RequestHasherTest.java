package com.tallyvault.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.tallyvault.transfer.RequestHasher;
import com.tallyvault.transfer.TransferDtos;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RequestHasherTest {
    private final UUID source = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private final UUID destination = UUID.fromString("00000000-0000-0000-0000-000000000002");

    @Test void equivalentMoneyRepresentationsHashIdentically() {
        var first = new TransferDtos.TransferRequest(source, destination, new BigDecimal("50"), "rent");
        var second = new TransferDtos.TransferRequest(source, destination, new BigDecimal("50.00"), " rent ");
        assertThat(RequestHasher.transfer(first)).isEqualTo(RequestHasher.transfer(second));
    }

    @Test void changedRequestDoesNotReuseHash() {
        var first = new TransferDtos.TransferRequest(source, destination, new BigDecimal("50.00"), "rent");
        var second = new TransferDtos.TransferRequest(source, destination, new BigDecimal("51.00"), "rent");
        assertThat(RequestHasher.transfer(first)).isNotEqualTo(RequestHasher.transfer(second));
    }
}

