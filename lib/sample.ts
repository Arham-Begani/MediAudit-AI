// A realistic, privacy-masked OCR capture of a multi-page ER statement.
// Seeded with the three institutional patterns the auditor hunts for:
// upcoding (a high-level ER E/M code for a minor visit), duplicate billing
// (the treatment room charged twice under varied names), and unbundled
// supply fees (saline flush, gloves, basic kit billed separately).

export const SAMPLE_REGION = "California";

export const SAMPLE_BILL = `MERIDIAN VALLEY REGIONAL MEDICAL CENTER
ITEMIZED STATEMENT OF ACCOUNT  (PAGE 1 OF 2)
PATIENT: [MASKED]   DOB: [MASKED]   MRN: [MASKED]   ACCT: [MASKED]
DATE OF SERVICE: 03/14/2026   POS: 23 EMERGENCY ROOM - HOSPITAL

LINE  CODE        DESCRIPTION                              CHARGE
001   99285       ER VISIT EM LEVEL 5 HIGH COMPLEX         1,842.00
002   G0463       HOSP OUTPT CLINIC VISIT ASSESS           312.00
003   450         EMERGENCY ROOM - GENERAL                 980.00
004   ER ROOM     TREATMENT RM OBSERV PER HR x2            960.00
005   J7030       INFUS NORMAL SALINE SOLN 1000ML          88.00
006   96360       IV INFUS HYDRATION INIT 31MIN-1HR        445.00
007   96361       IV INFUS HYDRATION EA ADDL HR            210.00
008   SUPPLY      SALINE FLUSH 10ML PREFILLED SYR x3       54.00

ITEMIZED STATEMENT OF ACCOUNT  (PAGE 2 OF 2)
LINE  CODE        DESCRIPTION                              CHARGE
009   A4216       STERILE WATER/SALINE 10ML                36.00
010   SUPPLY      EXAM GLOVES NON-STERILE PR x4            28.00
011   OR KIT IV   OR SUPPLY KIT LEVEL IV GEN               690.00
012   85025       CBC W/ AUTO DIFFERENTIAL                 145.00
013   80053       COMPREHENSIVE METABOLIC PANEL            168.00
014   71046       XR CHEST 2 VIEWS                         410.00
015   ER FAC      EMERGENCY DEPT FACILITY FEE LVL V        1,210.00
016   SUPPLY      BANDAGE/GAUZE STERILE DRESSING           41.00
017   Q9967       CONTRAST LOCM 300MG/ML 50ML              0.00
018   86850       PARACETAMOL 500MG PO TAB x2              42.00

ESTIMATED PATIENT RESPONSIBILITY AFTER ADJUSTMENTS: 7,811.00
*** THIS IS NOT A BILL FROM YOUR INSURANCE CARRIER ***`;
