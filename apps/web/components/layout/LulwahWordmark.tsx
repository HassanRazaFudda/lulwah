/**
 * "LULWAH" and "FASHION" — extracted the same way as `LulwahMonogram.tsx`'s
 * "LF" mark: not redrawn in a substitute typeface, but reproduced path-for-
 * path from the client's own source file.
 *
 * The earlier version of this wordmark used a real Latin serif web font
 * (Bodoni Moda) tuned by eye against screenshots of `LULWAH.ai`/`LULWAH.pdf`
 * — weight, size and tracking corrected round after round, but still an
 * approximation of a different typeface, not the source file's own
 * letterforms. Asked directly why that approach was used instead of
 * extracting the real glyphs, the honest answer was: it hadn't been tried
 * yet for the wordmark (only the monogram got real vector extraction), so
 * this component is that follow-through.
 *
 * `LULWAH.ai` turns out to be PDF-compatible (Illustrator's default save
 * format), and embeds the wordmark's actual TrueType font program
 * (`FontFile2`) rather than outlined paths. That embedded font's own
 * internal name is `YBWARR+Jameel-Noori-Nastaleeq-Kasheeda` — a Nastaliq/
 * Urdu-calligraphy font name that has nothing to do with the clean Latin
 * serif it actually renders (confirmed by extracting the font program and
 * test-rendering it: the glyphs are a real, unrelated Didone-style Latin
 * face). PDF subsetting tools commonly strip/rewrite a font's own name
 * table when they build a page-specific subset, so the original typeface's
 * real identity is gone — this file's `name` table has been overwritten
 * with the subset tag for every field, including the family name.
 *
 * That name mismatch, plus the font being a full ~25,600-glyph program (not
 * a small custom subset built just for this logo), is why this component
 * does not embed that font file itself and load it as a web font: with no
 * way to verify what commercial typeface it actually is or what its
 * licence permits, redistributing the whole font program on a public
 * website carries real licensing risk. Extracting only the ~10 individual
 * letterforms this wordmark actually uses (L, U, W, A, H, F, S, I, O, N) as
 * static vector outlines and shipping just those — never the font program
 * itself — is the same thing a designer does by converting logo type to
 * outlines before handing off final art, and it's what `LulwahMonogram.tsx`
 * already does for the "LF" mark.
 *
 * Extraction method: parsed the embedded TrueType program directly out of
 * `LULWAH.ai`'s `FontFile2` stream (`cmap` → glyph ID, `loca` + `glyf` →
 * quadratic outline points, `hmtx` → advance widths), converted each
 * letter's quadratic contours straight to SVG `Q` commands (TrueType's own
 * curve type — no cubic conversion or re-fitting involved), and laid the
 * letters out left-to-right using the font's own advance widths, exactly
 * matching the spacing baked into the source file. No manual tracing.
 *
 * `currentColor`, not a hardcoded fill — same reasoning as the monogram:
 * `Header.tsx` switches the colour per header state, and a vector mark
 * takes whatever colour paints it.
 */
export function LulwahWord({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 7258 1169" className={className} fill="currentColor" aria-hidden="true">
      <path d="M 929 829 L 956 835 L 861 1137 L 0 1137 L 0 1107 L 41 1107 Q 112 1107 142 1061 Q 160 1034 160 939 L 160 222 Q 160 118 137 91 Q 105 55 41 55 L 0 55 L 0 25 L 503 25 L 503 55 Q 415 55 379 72 Q 343 89 330 115.5 Q 317 142 317 241 L 317 939 Q 317 1007 330 1033 Q 340 1050 360.5 1058 Q 381 1066 488 1066 L 570 1066 Q 697 1066 749 1047.5 Q 801 1029 843.5 981 Q 886 933 929 829 Z M 1808 61 L 1808 31 L 2202 31 L 2202 61 L 2160 61 Q 2094 61 2059 116 Q 2042 142 2042 234 L 2042 685 Q 2042 852 2008.5 944.5 Q 1975 1037 1878 1103 Q 1781 1169 1614 1169 Q 1432 1169 1337.5 1106 Q 1243 1043 1204 936 Q 1178 863 1178 662 L 1178 228 Q 1178 125 1149.5 93 Q 1121 61 1058 61 L 1016 61 L 1016 31 L 1497 31 L 1497 61 L 1454 61 Q 1385 61 1356 105 Q 1335 134 1335 228 L 1335 712 Q 1335 777 1347 860.5 Q 1359 944 1390 991 Q 1421 1038 1479.5 1068 Q 1538 1098 1624 1098 Q 1733 1098 1819 1050.5 Q 1905 1003 1936.5 929 Q 1968 855 1968 678 L 1968 228 Q 1968 123 1945 97 Q 1913 61 1850 61 L 1808 61 Z M 3189 829 L 3216 835 L 3121 1137 L 2260 1137 L 2260 1107 L 2301 1107 Q 2372 1107 2402 1061 Q 2420 1034 2420 939 L 2420 222 Q 2420 118 2397 91 Q 2365 55 2301 55 L 2260 55 L 2260 25 L 2763 25 L 2763 55 Q 2675 55 2639 72 Q 2603 89 2590 115.5 Q 2577 142 2577 241 L 2577 939 Q 2577 1007 2590 1033 Q 2600 1050 2620.5 1058 Q 2641 1066 2748 1066 L 2830 1066 Q 2957 1066 3009 1047.5 Q 3061 1029 3103.5 981 Q 3146 933 3189 829 Z M 4839 31 L 4839 61 Q 4795 61 4768 76.5 Q 4741 92 4717 135 Q 4700 163 4665 272 L 4355 1168 L 4322 1168 L 4069 457 L 3817 1168 L 3788 1168 L 3457 245 Q 3420 141 3411 122 Q 3394 91 3366 76 Q 3338 61 3289 61 L 3289 31 L 3701 31 L 3701 61 L 3681 61 Q 3638 61 3615 80.5 Q 3592 100 3592 128 Q 3592 157 3628 260 L 3847 884 L 4031 354 L 3998 260 L 3972 186 Q 3955 145 3934 113 Q 3923 98 3907 87 Q 3887 72 3866 66 Q 3851 61 3817 61 L 3817 31 L 4250 31 L 4250 61 L 4221 61 Q 4175 61 4153.5 80.5 Q 4132 100 4132 134 Q 4132 176 4169 280 L 4382 884 L 4594 272 Q 4630 170 4630 131 Q 4630 112 4618 95.5 Q 4606 79 4588 72 Q 4557 61 4507 61 L 4507 31 L 4839 31 Z M 5628 765 L 5198 765 L 5122 940 Q 5095 1005 5095 1037 Q 5095 1062 5119 1081.5 Q 5143 1101 5223 1107 L 5223 1137 L 4873 1137 L 4873 1107 Q 4943 1094 4963 1075 Q 5005 1035 5056 915 L 5447 0 L 5476 0 L 5863 925 Q 5910 1036 5948 1069.5 Q 5986 1103 6054 1107 L 6054 1137 L 5615 1137 L 5615 1107 Q 5682 1103 5705 1084.5 Q 5728 1066 5728 1039 Q 5728 1003 5696 925 L 5628 765 Z M 5605 704 L 5417 255 L 5223 704 L 5605 704 Z M 6425 541 L 6942 541 L 6942 223 Q 6942 137 6931 110 Q 6923 90 6897 75 Q 6861 55 6822 55 L 6783 55 L 6783 25 L 7258 25 L 7258 55 L 7219 55 Q 7180 55 7144 74 Q 7118 87 7108.5 114 Q 7099 141 7099 223 L 7099 940 Q 7099 1025 7110 1052 Q 7118 1072 7144 1087 Q 7180 1107 7219 1107 L 7258 1107 L 7258 1137 L 6783 1137 L 6783 1107 L 6822 1107 Q 6890 1107 6921 1066 Q 6942 1040 6942 940 L 6942 602 L 6425 602 L 6425 940 Q 6425 1025 6436 1052 Q 6444 1072 6470 1087 Q 6506 1107 6545 1107 L 6585 1107 L 6585 1137 L 6109 1137 L 6109 1107 L 6148 1107 Q 6217 1107 6248 1066 Q 6268 1040 6268 940 L 6268 223 Q 6268 137 6257 110 Q 6249 90 6224 75 Q 6187 55 6148 55 L 6109 55 L 6109 25 L 6585 25 L 6585 55 L 6545 55 Q 6506 55 6470 74 Q 6445 87 6435 114 Q 6425 141 6425 223 L 6425 541 Z" />
    </svg>
  );
}

/**
 * Tracked +0.16em between letters (the project's own `letterSpacing.label`
 * token — packages/tokens/src/typography.ts — the same tracking "Fashion"
 * used back when it was still web-font text) — the source file's own
 * advance widths sit each letter flush against the next, which reads fine
 * for "LULWAH" but too tight for "FASHION" at this small a size next to
 * the hairlines. Baked into the path itself at build time (each letter
 * re-translated by an extra 0.16em × unitsPerEm per gap, not applied after
 * the final letter) rather than done with CSS, since this is no longer
 * live text — see this file's own top doc comment.
 */
export function FashionWord({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 9324.08 1168" className={className} fill="currentColor" aria-hidden="true">
      <path d="M 317 86 L 317 523 L 519 523 Q 589 523 621.5 492 Q 654 461 664 370 L 695 370 L 695 747 L 664 747 Q 663 682 647 651.5 Q 631 621 603 606 Q 575 591 519 591 L 317 591 L 317 940 Q 317 1025 327 1052 Q 335 1072 362 1087 Q 398 1107 437 1107 L 477 1107 L 477 1137 L 0 1137 L 0 1107 L 39 1107 Q 108 1107 139 1066 Q 159 1040 159 940 L 159 222 Q 159 137 148 110 Q 140 90 115 75 Q 80 55 39 55 L 0 55 L 0 25 L 827 25 L 838 269 L 809 269 Q 788 192 760 155.5 Q 732 119 690.5 102.5 Q 649 86 562 86 L 317 86 Z M 2023.68 765 L 1593.68 765 L 1517.68 940 Q 1490.68 1005 1490.68 1037 Q 1490.68 1062 1514.68 1081.5 Q 1538.68 1101 1618.68 1107 L 1618.68 1137 L 1268.68 1137 L 1268.68 1107 Q 1338.68 1094 1358.68 1075 Q 1400.68 1035 1451.68 915 L 1842.68 0 L 1871.68 0 L 2258.68 925 Q 2305.68 1036 2343.68 1069.5 Q 2381.68 1103 2449.68 1107 L 2449.68 1137 L 2010.68 1137 L 2010.68 1107 Q 2077.68 1103 2100.68 1084.5 Q 2123.68 1066 2123.68 1039 Q 2123.68 1003 2091.68 925 L 2023.68 765 Z M 2000.68 704 L 1812.68 255 L 1618.68 704 L 2000.68 704 Z M 3573.36 5 L 3573.36 390 L 3543.36 390 Q 3528.36 279 3490.36 213.5 Q 3452.36 148 3381.86 109.5 Q 3311.36 71 3235.36 71 Q 3150.36 71 3094.36 123 Q 3038.36 175 3038.36 241 Q 3038.36 292 3074.36 334 Q 3124.36 396 3316.36 498 Q 3471.36 582 3528.36 626.5 Q 3585.36 671 3616.36 731.5 Q 3647.36 792 3647.36 859 Q 3647.36 985 3549.36 1076.5 Q 3451.36 1168 3297.36 1168 Q 3248.36 1168 3206.36 1161 Q 3180.36 1157 3100.36 1131 Q 3020.36 1105 2999.36 1105 Q 2978.36 1105 2966.86 1117 Q 2955.36 1129 2949.36 1168 L 2919.36 1168 L 2919.36 787 L 2949.36 787 Q 2970.36 906 3006.36 965.5 Q 3042.36 1025 3116.86 1064.5 Q 3191.36 1104 3279.36 1104 Q 3382.36 1104 3441.86 1050 Q 3501.36 996 3501.36 922 Q 3501.36 881 3478.86 839 Q 3456.36 797 3408.36 761 Q 3376.36 737 3233.86 657 Q 3091.36 577 3030.86 529.5 Q 2970.36 482 2939.36 424.5 Q 2908.36 367 2908.36 298 Q 2908.36 178 3000.36 91.5 Q 3092.36 5 3234.36 5 Q 3322.36 5 3421.36 49 Q 3467.36 69 3486.36 69 Q 3507.36 69 3520.86 56.5 Q 3534.36 44 3543.36 5 L 3573.36 5 Z M 4453.04 541 L 4970.04 541 L 4970.04 223 Q 4970.04 137 4959.04 110 Q 4951.04 90 4925.04 75 Q 4889.04 55 4850.04 55 L 4811.04 55 L 4811.04 25 L 5286.04 25 L 5286.04 55 L 5247.04 55 Q 5208.04 55 5172.04 74 Q 5146.04 87 5136.54 114 Q 5127.04 141 5127.04 223 L 5127.04 940 Q 5127.04 1025 5138.04 1052 Q 5146.04 1072 5172.04 1087 Q 5208.04 1107 5247.04 1107 L 5286.04 1107 L 5286.04 1137 L 4811.04 1137 L 4811.04 1107 L 4850.04 1107 Q 4918.04 1107 4949.04 1066 Q 4970.04 1040 4970.04 940 L 4970.04 602 L 4453.04 602 L 4453.04 940 Q 4453.04 1025 4464.04 1052 Q 4472.04 1072 4498.04 1087 Q 4534.04 1107 4573.04 1107 L 4613.04 1107 L 4613.04 1137 L 4137.04 1137 L 4137.04 1107 L 4176.04 1107 Q 4245.04 1107 4276.04 1066 Q 4296.04 1040 4296.04 940 L 4296.04 223 Q 4296.04 137 4285.04 110 Q 4277.04 90 4252.04 75 Q 4215.04 55 4176.04 55 L 4137.04 55 L 4137.04 25 L 4613.04 25 L 4613.04 55 L 4573.04 55 Q 4534.04 55 4498.04 74 Q 4473.04 87 4463.04 114 Q 4453.04 141 4453.04 223 L 4453.04 541 Z M 6180.72 1107 L 6180.72 1137 L 5704.72 1137 L 5704.72 1107 L 5743.72 1107 Q 5812.72 1107 5843.72 1066 Q 5863.72 1040 5863.72 940 L 5863.72 222 Q 5863.72 137 5852.72 110 Q 5844.72 90 5819.72 75 Q 5783.72 55 5743.72 55 L 5704.72 55 L 5704.72 25 L 6180.72 25 L 6180.72 55 L 6140.72 55 Q 6072.72 55 6041.72 96 Q 6020.72 122 6020.72 222 L 6020.72 940 Q 6020.72 1025 6031.72 1052 Q 6039.72 1072 6065.72 1087 Q 6101.72 1107 6140.72 1107 L 6180.72 1107 Z M 7181.4 5 Q 7398.4 5 7556.9 169.5 Q 7715.4 334 7715.4 580 Q 7715.4 833 7555.4 1000.5 Q 7395.4 1168 7168.4 1168 Q 6938.4 1168 6782.4 1005 Q 6626.4 842 6626.4 583 Q 6626.4 318 6806.4 150 Q 6963.4 5 7181.4 5 Z M 7166.4 65 Q 7016.4 65 6926.4 176 Q 6814.4 314 6814.4 579 Q 6814.4 851 6930.4 998 Q 7020.4 1110 7166.4 1110 Q 7323.4 1110 7425.4 987.5 Q 7527.4 865 7527.4 602 Q 7527.4 317 7415.4 177 Q 7325.4 65 7166.4 65 Z M 8113.08 29 L 8415.08 29 L 9094.08 863 L 9094.08 222 Q 9094.08 119 9071.08 94 Q 9041.08 59 8976.08 59 L 8937.08 59 L 8937.08 29 L 9324.08 29 L 9324.08 59 L 9285.08 59 Q 9214.08 59 9185.08 102 Q 9167.08 128 9167.08 222 L 9167.08 1159 L 9137.08 1159 L 8404.08 264 L 8404.08 948 Q 8404.08 1051 8426.08 1076 Q 8457.08 1111 8522.08 1111 L 8561.08 1111 L 8561.08 1141 L 8174.08 1141 L 8174.08 1111 L 8213.08 1111 Q 8284.08 1111 8314.08 1068 Q 8332.08 1042 8332.08 948 L 8332.08 175 Q 8283.08 118 8258.08 100 Q 8233.08 82 8185.08 67 Q 8161.08 59 8113.08 59 L 8113.08 29 Z" />
    </svg>
  );
}
