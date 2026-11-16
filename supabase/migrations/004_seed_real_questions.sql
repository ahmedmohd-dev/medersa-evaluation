-- ============================================================================
-- Medersa Ustaz Evaluation Management System
-- Migration 004: Seed Real 11 Questionnaire Questions (Out of 90 Marks)
-- ============================================================================

INSERT INTO public.evaluation_questions (
  template_id,
  question_text,
  question_type,
  maximum_mark,
  is_required,
  is_active,
  display_order,
  choices
) 
SELECT
  t.id,
  q.question_text,
  'multiple_choice',
  q.maximum_mark,
  true,
  true,
  q.display_order,
  q.choices::jsonb
FROM public.evaluation_templates t
CROSS JOIN (
  VALUES
    (
      1,
      'ኡስታዙ በሰዓቱ መድረሳ ይገባል?',
      6.00,
      '[
        {"letter": "ሀ", "text": "አዎ በሰዓቱ ይገባል", "mark": 6},
        {"letter": "ለ", "text": "አንዳንዴ ያረፍዳል", "mark": 3},
        {"letter": "ሐ", "text": "ሁሌ ያረፍዳል", "mark": 0}
      ]'
    ),
    (
      2,
      'አስፈላጊ የሆኑ የመድረሳ እቃዎችን (ዱላ፣ የመከታተያ ደብተር ወዘተ) ይዞ ይገባል?',
      4.00,
      '[
        {"letter": "ሀ", "text": "ሁልጊዜ ይዞ ይገባል", "mark": 4},
        {"letter": "ለ", "text": "አንዳንዴ ይረሳል", "mark": 2},
        {"letter": "ሐ", "text": "ጨርሶ አይዝም", "mark": 0}
      ]'
    ),
    (
      3,
      'ቁርአን የሚያስቀራበት እና ትምህርቱን የሚያስረዳበት መንገድ ግልጽ ነው?',
      10.00,
      '[
        {"letter": "ሀ", "text": "በጣም ግልጽ ነው", "mark": 10},
        {"letter": "ለ", "text": "መካከለኛ ነው", "mark": 5},
        {"letter": "ሐ", "text": "አይገባኝም", "mark": 0}
      ]'
    ),
    (
      4,
      'ሂስኑል ሙስሊም እና የቤት ስራ በየጊዜው ይሰጣል፤ ያርማል?',
      10.00,
      '[
        {"letter": "ሀ", "text": "አዎ ሁልጊዜ ይሰጣል፣ ያርማል", "mark": 10},
        {"letter": "ለ", "text": "ይሰጣል ግን አያርምም", "mark": 6},
        {"letter": "ሐ", "text": "አይሰጥም / አያርምም", "mark": 0},
        {"letter": "መ", "text": "አንዳንዴ አይሰጥም", "mark": 5}
      ]'
    ),
    (
      5,
      'የተማሪዎችን የተርቢያ ደብተር፣ ተጅዊድ፣ ሰፊና እና ሂፍዝ በትክክል ይከታተላል?',
      10.00,
      '[
        {"letter": "ሀ", "text": "ሁልጊዜ በደንብ ይከታተላል", "mark": 10},
        {"letter": "ለ", "text": "አንዳንዴ ብቻ ይመለከታል", "mark": 6},
        {"letter": "ሐ", "text": "ክትትል የለውም", "mark": 0}
      ]'
    ),
    (
      6,
      'ኡስታዙ ልጆችን እያሳፈዘ ስልክ መነካካት ወይም ሌላ ስራ መስራት ያበዛል?',
      10.00,
      '[
        {"letter": "ሀ", "text": "በጭራሽ ትኩረቱ ተማሪው ላይ ነው", "mark": 10},
        {"letter": "ለ", "text": "አንዳንዴ ስልክ ይጠቀማል", "mark": 5},
        {"letter": "ሐ", "text": "አዎ ሌላ ስራ ያበዛል", "mark": 0}
      ]'
    ),
    (
      7,
      'ተማሪዎችን ያለአግባብ መቆጣት ወይም ማመናጨቅ ይታይበታል?',
      8.00,
      '[
        {"letter": "ሀ", "text": "በጭራሽ ያለ አግባብ አይቆጣም / ትሁት ነው", "mark": 8},
        {"letter": "ለ", "text": "አልፎ አልፎ ይቆጣል", "mark": 4},
        {"letter": "ሐ", "text": "አዎ ሁሌ ያመናጭቃል", "mark": 0}
      ]'
    ),
    (
      8,
      'አግባብ ባልሆነ ነገር ተማሪዎችን ይገርፋል?',
      8.00,
      '[
        {"letter": "ሀ", "text": "በጭራሽ ያለጥፋት አይገርፍም", "mark": 8},
        {"letter": "ለ", "text": "አንዳንዴ ያለአግባብ ይቀጣል", "mark": 4},
        {"letter": "ሐ", "text": "አዎ ያለአግባብ ይገርፋል", "mark": 0}
      ]'
    ),
    (
      9,
      'ለተማሪዎች ችግር መፍትሄ ለመስጠት ይጨነቃል/ይጥራል?',
      6.00,
      '[
        {"letter": "ሀ", "text": "አዎ በጣም ይጨነቃል/ይረዳል", "mark": 6},
        {"letter": "ለ", "text": "መካከለኛ ነው", "mark": 3},
        {"letter": "ሐ", "text": "ግድ የለውም", "mark": 0}
      ]'
    ),
    (
      10,
      'በቡድኑ ውስጥ ፀጥታና ስርዓት ያስጠብቃል?',
      10.00,
      '[
        {"letter": "ሀ", "text": "አዎ በደንብ ይጠብቃል", "mark": 10},
        {"letter": "ለ", "text": "መሀከለኛ ነው", "mark": 5},
        {"letter": "ሐ", "text": "ብዙ ጊዜ ይረበሻል", "mark": 0}
      ]'
    ),
    (
      11,
      'ተማሪዎችን በእኩል ዓይን ይመለከታል?',
      8.00,
      '[
        {"letter": "ሀ", "text": "አዎ እኩል ያያል", "mark": 8},
        {"letter": "ለ", "text": "አንዳንዴ ያደላል", "mark": 4},
        {"letter": "ሐ", "text": "ልዩነት ያደርጋል", "mark": 0}
      ]'
    )
) AS q(display_order, question_text, maximum_mark, choices)
WHERE t.is_active = true
ORDER BY q.display_order;
