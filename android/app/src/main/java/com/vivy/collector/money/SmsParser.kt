package com.vivy.collector.money

import java.math.BigDecimal
import java.math.RoundingMode

data class ParsedTransaction(
    val amountMinor: Int,
    val direction: String,
    val method: String,
    val accountRef: String?,
    val counterparty: String?,
    val balanceAfterMinor: Int?,
    val templateId: String,
    val confidence: Double,
)

sealed interface SmsParseOutcome {
    data class Parsed(val transaction: ParsedTransaction) : SmsParseOutcome
    data class Dropped(val reason: String) : SmsParseOutcome
    data class Unmatched(val reason: String) : SmsParseOutcome
}

object SmsParser {
    const val VERSION = "sms-parser@v1"

    private val otpMarkers = listOf(
        Regex("""\botp\b""", RegexOption.IGNORE_CASE),
        Regex("""\bone[\s-]?time\s*(?:password|passcode|pin|code)\b""", RegexOption.IGNORE_CASE),
        Regex("""\bverification\s+code\b""", RegexOption.IGNORE_CASE),
        Regex("""\bsecurity\s+code\b""", RegexOption.IGNORE_CASE),
        Regex("""\bauth(?:entication)?\s+code\b""", RegexOption.IGNORE_CASE),
        Regex("""\b(?:do\s*not|never)\s+share\b""", RegexOption.IGNORE_CASE),
        Regex("""\bvalid\s+for\s+\d+\s*(?:min|sec)""", RegexOption.IGNORE_CASE),
        Regex("""\b\d{4,8}\s+is\s+your\b""", RegexOption.IGNORE_CASE),
    )

    private val nonTransactions = listOf(
        Regex("""\bwill\s+be\s+(?:debited|deducted|charged)\b""", RegexOption.IGNORE_CASE),
        Regex("""\bdue\s+(?:on|by|date)\b""", RegexOption.IGNORE_CASE),
        Regex("""\brequest(?:ed|ing)?\s+(?:money|payment)\b""", RegexOption.IGNORE_CASE),
        Regex("""\bhas\s+requested\b""", RegexOption.IGNORE_CASE),
        Regex("""\b(?:apply\s+now|offer|cashback\s+of|pre[\s-]?approved)\b""", RegexOption.IGNORE_CASE),
        Regex("""\b(?:declined|failed|reversed)\b""", RegexOption.IGNORE_CASE),
    )

    private val amount = Regex(
        """(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)""",
        RegexOption.IGNORE_CASE,
    )
    private val balance = Regex(
        """(?:avl|available|avail)?\.?\s*(?:bal|balance)\.?\s*(?:is)?\s*:?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)""",
        RegexOption.IGNORE_CASE,
    )
    private val sbiDebit = Regex(
        """A/C\s*[xX*]{1,6}\s*(\d{3,6})\s+debited\s+by\s+([\d,]+(?:\.\d{1,2})?)\s+on\s+date\s+\S+\s+trf\s+to\s+(.+?)\s+Ref""",
        RegexOption.IGNORE_CASE,
    )
    private val cardSpend = Regex(
        """(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+spent\s+(?:on|using)\s+(?:your\s+)?.*?card\s*[xX*]{0,6}\s*(\d{3,6})\s+at\s+(.+?)(?:\s+on\s|\.|$)""",
        RegexOption.IGNORE_CASE,
    )
    private val debitAccount = Regex(
        """(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:has\s+been\s+)?debited\s+from\s+(?:your\s+)?(?:bank\s+)?A/?c(?:count)?\.?\s*(?:no\.?\s*)?[xX*]{0,6}\s*(\d{3,6})""",
        RegexOption.IGNORE_CASE,
    )
    private val creditAccount = Regex(
        """(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:has\s+been\s+)?credited\s+(?:to\s+)?(?:your\s+)?(?:bank\s+)?A/?c(?:count)?\.?\s*(?:no\.?\s*)?[xX*]{0,6}\s*(\d{3,6})""",
        RegexOption.IGNORE_CASE,
    )
    private val vpa = Regex("""\bVPA\s+([\w.@-]+)""", RegexOption.IGNORE_CASE)

    fun parse(text: String): SmsParseOutcome {
        if (otpMarkers.any { it.containsMatchIn(text) }) return SmsParseOutcome.Dropped("otp")
        if (nonTransactions.any { it.containsMatchIn(text) }) {
            return SmsParseOutcome.Dropped("non-transactional")
        }

        sbiDebit.find(text)?.let { match ->
            return parsed(
                match.groupValues[2],
                "debit",
                "upi",
                match.groupValues[1],
                match.groupValues[3],
                text,
                "sbi.upi.debit",
                0.95,
            )
        }
        cardSpend.find(text)?.let { match ->
            return parsed(
                match.groupValues[1],
                "debit",
                "card",
                match.groupValues[2],
                match.groupValues[3],
                text,
                "card.spent.at",
                0.93,
            )
        }
        debitAccount.find(text)?.let { match ->
            return parsed(
                match.groupValues[1],
                "debit",
                guessMethod(text),
                match.groupValues[2],
                vpa.find(text)?.groupValues?.get(1),
                text,
                "generic.debit.account",
                if (vpa.containsMatchIn(text)) 0.9 else 0.8,
            )
        }
        creditAccount.find(text)?.let { match ->
            return parsed(
                match.groupValues[1],
                "credit",
                guessMethod(text),
                match.groupValues[2],
                vpa.find(text)?.groupValues?.get(1),
                text,
                "generic.credit.account",
                0.8,
            )
        }

        val amountMinor = amount.find(text)?.groupValues?.get(1)?.let(::toMinorUnits)
        val direction = when {
            Regex("""\b(debited|spent|withdrawn|paid|purchase)\b""", RegexOption.IGNORE_CASE)
                .containsMatchIn(text) -> "debit"
            Regex("""\b(credited|received|deposited|refund)\b""", RegexOption.IGNORE_CASE)
                .containsMatchIn(text) -> "credit"
            else -> null
        }
        if (amountMinor != null && amountMinor > 0 && direction != null) {
            return SmsParseOutcome.Parsed(
                ParsedTransaction(
                    amountMinor = amountMinor,
                    direction = direction,
                    method = guessMethod(text),
                    accountRef = Regex("""[xX*]{2,}\s*(\d{3,6})""")
                        .find(text)?.groupValues?.get(1),
                    counterparty = null,
                    balanceAfterMinor = balanceAfter(text),
                    templateId = "fallback.heuristic",
                    confidence = 0.45,
                ),
            )
        }

        return SmsParseOutcome.Unmatched(
            if (amountMinor == null) "no amount found" else "no direction found",
        )
    }

    fun isPlausibleFinancialSender(sender: String, text: String): Boolean {
        val shortCode = sender.length in 3..18 && sender.any(Char::isLetter) && !sender.contains(' ')
        val hasFinancialTerm = Regex(
            """\b(a/?c|account|bank|card|upi|vpa|balance|bal|debited|credited|spent|paid|refund|neft|imps|rtgs)\b""",
            RegexOption.IGNORE_CASE,
        ).containsMatchIn(text)
        return shortCode && amount.containsMatchIn(text) && hasFinancialTerm
    }

    private fun parsed(
        amountRaw: String,
        direction: String,
        method: String,
        accountRef: String?,
        counterparty: String?,
        text: String,
        templateId: String,
        confidence: Double,
    ): SmsParseOutcome {
        val amountMinor = toMinorUnits(amountRaw) ?: return SmsParseOutcome.Unmatched("bad amount")
        if (amountMinor <= 0) return SmsParseOutcome.Unmatched("bad amount")
        return SmsParseOutcome.Parsed(
            ParsedTransaction(
                amountMinor,
                direction,
                method,
                accountRef?.ifBlank { null },
                normaliseCounterparty(counterparty),
                balanceAfter(text),
                templateId,
                confidence,
            ),
        )
    }

    private fun toMinorUnits(raw: String): Int? = runCatching {
        val value = BigDecimal(raw.replace(",", "").trim()).setScale(2, RoundingMode.UNNECESSARY)
        value.movePointRight(2).intValueExact()
    }.getOrNull()

    private fun balanceAfter(text: String): Int? =
        balance.find(text)?.groupValues?.get(1)?.let(::toMinorUnits)

    private fun normaliseCounterparty(raw: String?): String? {
        val cleaned = raw?.replace(Regex("""\s+"""), " ")
            ?.trim()
            ?.trimEnd('.', ',', ';', ':')
            ?.takeIf { it.isNotBlank() && it.length <= 64 }
            ?: return null
        val handle = Regex("""^([\w.-]+)@[\w-]+$""").matchEntire(cleaned)?.groupValues?.get(1)
        return (handle?.replace(Regex("""[._-]+"""), " ") ?: cleaned).trim().uppercase()
    }

    private fun guessMethod(text: String): String = when {
        Regex("""\bupi\b|\bvpa\b|@[\w-]+""", RegexOption.IGNORE_CASE).containsMatchIn(text) -> "upi"
        Regex("""\bcard\b|\bpos\b""", RegexOption.IGNORE_CASE).containsMatchIn(text) -> "card"
        Regex("""\bneft\b|\bimps\b|\brtgs\b|\btransfer\b""", RegexOption.IGNORE_CASE)
            .containsMatchIn(text) -> "transfer"
        Regex("""\bach\b|\bmandate\b|\bauto[\s-]?debit\b|\benach\b""", RegexOption.IGNORE_CASE)
            .containsMatchIn(text) -> "auto-debit"
        Regex("""\batm\b|\bcash\b""", RegexOption.IGNORE_CASE).containsMatchIn(text) -> "cash"
        else -> "unknown"
    }
}
