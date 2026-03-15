using System.Collections.Generic;
using System.Linq;

partial class Program
{
    static IEnumerable<string> GetCompoundDigitPhrases()
    {
        var seqs4 = GetDigitSequenceList(maxDigits: 4);
        var seqs3 = GetDigitSequenceList(maxDigits: 3);

        // "[digits] set"  e.g. "one zero two three set"
        // "[digits] tons" e.g. "nine tons"
        // "[digits] feet" e.g. "one zero zero feet"
        var suffixes = new[] { "set", "tons", "feet" };
        foreach (var seq in seqs4)
        foreach (var suffix in suffixes)
            yield return $"{seq} {suffix}";

        // "[digits] point [digits] tons"  e.g. "nine point five tons", "one zero zero point two tons"
        var singleDigits = new[]
        {
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
            "niner",
        };
        foreach (var intSeq in seqs3)
        foreach (var dec in singleDigits)
            yield return $"{intSeq} point {dec} tons";

        // Prefix patterns: "set altitude [digits]", "set heading [digits]", etc.
        var prefixes = new[]
        {
            "set altitude",
            "set heading",
            "set speed",
            "set flight level",
            "set missed approach altitude",
            "pull heading",
            "pull speed",
        };
        foreach (var seq in seqs4)
        foreach (var prefix in prefixes)
            yield return $"{prefix} {seq}";

        // "man flex [spoken temp]"
        foreach (var spoken in GetSpokenNumberWordForms(40, 75))
            yield return $"man flex {spoken}";

        // Natural-number tons: "[spoken 1–150] tons" and "[spoken 1–150] point [digit] tons"
        var tonsDecimals = new[]
        {
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
        };
        foreach (var spoken in GetSpokenNumberWordForms(1, 150))
        {
            yield return $"{spoken} tons";
            foreach (var dec in tonsDecimals)
                yield return $"{spoken} point {dec} tons";
        }

        // "set altitude / altitude select [N] thousand [M hundred]?"
        var altThousandPrefixes = new[]
        {
            "set altitude",
            "altitude select",
            "set missed approach altitude",
        };
        foreach (var spoken in GetSpokenNumberWordForms(1, 43))
        foreach (var atp in altThousandPrefixes)
        {
            yield return $"{atp} {spoken} thousand";
            foreach (var hundredSpoken in GetSpokenNumberWordForms(1, 9))
                yield return $"{atp} {spoken} thousand {hundredSpoken} hundred";
        }
    }

    static List<string> GetDigitSequenceList(int maxDigits)
    {
        var digits = new[]
        {
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
            "niner",
        };

        var results = new List<string>(digits);
        for (int length = 2; length <= maxDigits; length++)
            BuildDigitSequences(digits, length, new List<string>(), results);

        return results;
    }

    static IEnumerable<string> GetDigitCommands(int maxDigits)
    {
        var digits = new[]
        {
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
            "niner",
        };

        var results = new List<string>();
        results.AddRange(digits);

        for (int length = 2; length <= maxDigits; length++)
            BuildDigitSequences(digits, length, new List<string>(), results);

        return results;
    }

    static void BuildDigitSequences(
        string[] digits,
        int remaining,
        List<string> current,
        List<string> output
    )
    {
        if (remaining == 0)
        {
            output.Add(string.Join(" ", current));
            return;
        }

        foreach (var d in digits)
        {
            current.Add(d);
            BuildDigitSequences(digits, remaining - 1, current, output);
            current.RemoveAt(current.Count - 1);
        }
    }

    /// Yields the spoken English word form of each integer in [min, max].
    /// Handles 1–199 (covers fuel tons up to 150 and flex temps).
    static IEnumerable<string> GetSpokenNumberWordForms(int min, int max)
    {
        var tens = new[]
        {
            "",
            "ten",
            "twenty",
            "thirty",
            "forty",
            "fifty",
            "sixty",
            "seventy",
            "eighty",
            "ninety",
        };
        var units = new[]
        {
            "",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
        };
        var teens = new[]
        {
            "ten",
            "eleven",
            "twelve",
            "thirteen",
            "fourteen",
            "fifteen",
            "sixteen",
            "seventeen",
            "eighteen",
            "nineteen",
        };

        for (int n = min; n <= max; n++)
        {
            if (n >= 100)
            {
                var remainder = n % 100;
                var hundredsPart = $"{units[n / 100]} hundred";
                if (remainder == 0)
                    yield return hundredsPart;
                else if (remainder >= 10 && remainder < 20)
                    yield return $"{hundredsPart} {teens[remainder - 10]}";
                else if (remainder % 10 == 0)
                    yield return $"{hundredsPart} {tens[remainder / 10]}";
                else if (remainder < 10)
                    yield return $"{hundredsPart} {units[remainder]}";
                else
                    yield return $"{hundredsPart} {tens[remainder / 10]} {units[remainder % 10]}";
            }
            else if (n >= 10 && n < 20)
                yield return teens[n - 10];
            else if (n % 10 == 0)
                yield return tens[n / 10];
            else if (n < 10)
                yield return units[n];
            else
                yield return $"{tens[n / 10]} {units[n % 10]}";
        }
    }

    /// Parses a spoken natural number (1–199) into its numeric string.
    /// e.g. "fifty five" → "55", "one hundred twenty five" → "125"
    static string? TryParseNaturalNumber(string text)
    {
        var tens = new Dictionary<string, int>
        {
            ["ten"] = 10,
            ["twenty"] = 20,
            ["thirty"] = 30,
            ["forty"] = 40,
            ["fifty"] = 50,
            ["sixty"] = 60,
            ["seventy"] = 70,
            ["eighty"] = 80,
            ["ninety"] = 90,
        };
        var units = new Dictionary<string, int>
        {
            ["one"] = 1,
            ["two"] = 2,
            ["three"] = 3,
            ["four"] = 4,
            ["five"] = 5,
            ["six"] = 6,
            ["seven"] = 7,
            ["eight"] = 8,
            ["nine"] = 9,
            ["eleven"] = 11,
            ["twelve"] = 12,
            ["thirteen"] = 13,
            ["fourteen"] = 14,
            ["fifteen"] = 15,
            ["sixteen"] = 16,
            ["seventeen"] = 17,
            ["eighteen"] = 18,
            ["nineteen"] = 19,
        };

        // Handle "[N] hundred [rest]" prefix
        var hundredIdx = text.IndexOf(" hundred");
        if (hundredIdx > 0)
        {
            var hundredsWord = text[..hundredIdx];
            if (units.TryGetValue(hundredsWord, out var hv) && hv >= 1 && hv <= 9)
            {
                var afterHundred = text[(hundredIdx + " hundred".Length)..].Trim();
                if (afterHundred.Length == 0)
                    return (hv * 100).ToString();

                // remainder is 1–99
                var rem = TryParseNaturalNumber(afterHundred);
                if (rem != null)
                    return (hv * 100 + int.Parse(rem)).ToString();
            }
        }

        if (units.TryGetValue(text, out var u))
            return u.ToString();
        if (tens.TryGetValue(text, out var t))
            return t.ToString();

        var i = text.IndexOf(' ');
        if (
            i > 0
            && tens.TryGetValue(text[..i], out var tv)
            && units.TryGetValue(text[(i + 1)..], out var uv)
            && uv < 10
        )
            return (tv + uv).ToString();

        return null;
    }
}
