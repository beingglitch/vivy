package com.vivy.collector.money

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsParserTest {
    @Test
    fun parsesSbiUpiDebitAndBalance() {
        val result = SmsParser.parse(
            "Dear UPI user A/C X4321 debited by 400.0 on date 05Sep26 trf to SWIGGY " +
                "Refno 123456789012. Avl Bal Rs.45,431.00 -SBI",
        )
        assertTrue(result is SmsParseOutcome.Parsed)
        val transaction = (result as SmsParseOutcome.Parsed).transaction
        assertEquals(40000, transaction.amountMinor)
        assertEquals("4321", transaction.accountRef)
        assertEquals("SWIGGY", transaction.counterparty)
        assertEquals(4543100, transaction.balanceAfterMinor)
        assertEquals("upi", transaction.method)
    }

    @Test
    fun parsesCardSpend() {
        val result = SmsParser.parse(
            "Rs.1200.00 spent on HDFC Bank Card x4321 at SWIGGY on 2026-09-05",
        ) as SmsParseOutcome.Parsed
        assertEquals(120000, result.transaction.amountMinor)
        assertEquals("card", result.transaction.method)
        assertEquals("SWIGGY", result.transaction.counterparty)
    }

    @Test
    fun stripsVpaProvider() {
        val result = SmsParser.parse(
            "Rs.250.00 debited from A/c XX4321 on 05-09-26 to VPA blinkit@ybl. Ref 998877",
        ) as SmsParseOutcome.Parsed
        assertEquals("BLINKIT", result.transaction.counterparty)
        assertEquals("upi", result.transaction.method)
    }

    @Test
    fun dropsOtpAndFutureDebit() {
        assertTrue(
            SmsParser.parse("123456 is your OTP for Rs 400. Do not share") is
                SmsParseOutcome.Dropped,
        )
        assertTrue(
            SmsParser.parse("Rs 7,649 will be debited on 10-09-26 towards SIP") is
                SmsParseOutcome.Dropped,
        )
    }

    @Test
    fun fallsBackWithoutInventingAccount() {
        val result = SmsParser.parse(
            "INR 99 debited towards annual charges. Bal: INR 4,500",
        ) as SmsParseOutcome.Parsed
        assertEquals(9900, result.transaction.amountMinor)
        assertEquals(450000, result.transaction.balanceAfterMinor)
        assertEquals(0.45, result.transaction.confidence, 0.001)
        assertNull(result.transaction.accountRef)
    }

    @Test
    fun acceptsBankSenderAndRejectsPersonalSender() {
        val text = "Rs.400.00 debited from A/c XX4321"
        assertTrue(SmsParser.isPlausibleFinancialSender("AD-HDFCBK", text))
        assertTrue(!SmsParser.isPlausibleFinancialSender("Rahul Sharma", text))
    }
}
