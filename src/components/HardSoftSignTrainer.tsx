import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Lightbulb,
  Shuffle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
} from "lucide-react";

// ===== Helpers =====
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Letter = "Ъ" | "Ь";

function fillMasked(masked: string, letter: Letter): string {
  const idx = masked.indexOf("?");
  if (idx === -1) return masked;
  return masked.slice(0, idx) + letter + masked.slice(idx + 1);
}

// ===== Data =====

type RuleId =
  | "hard-sign-after-prefix"
  | "hard-sign-foreign-prefixoids"
  | "hard-sign-numerals"
  | "soft-sign-not-after-prefix"
  | "tricky";

type RuleSource = { label: string; url: string; note?: string };

type RuleCard = {
  title: string;
  mapping: string;
  rule: string;
  examples: string[];
  exceptions?: string[];
  source: RuleSource;
  extra?: string;
};

type Item = {
  id: string;
  masked: string; // word with ? instead of Ъ/Ь
  answer: Letter;
  ruleId: RuleId;
  why: string; // one concise, relevant rule only
};

type ExamWord = {
  masked: string;
  expected: Letter;
  ruleId: RuleId;
  explanation: string;
};

type ExamOption = {
  id: string;
  words: ExamWord[];
  explanation: string;
  shouldSelect: boolean;
};

type ExamQuestion = {
  id: string;
  title: string;
  prompt: string;
  options: ExamOption[];
  source: RuleSource;
  note?: string;
};

const FIPI_SPEC_2025: RuleSource = {
  label: "ФИПИ, спецификация ЕГЭ-2025",
  url: "https://doc.fipi.ru/ege/demoversii-specifikacii-kodifikatory/2025/ru_11_2025.zip",
  note: "см. файл «РУ-11 ЕГЭ 2025 СПЕЦ.pdf», раздел 10",
};

const RULES: Record<RuleId, RuleCard> = {
  "hard-sign-after-prefix": {
    title: "Ъ после приставки",
    mapping: "приставка (на согласную) + Е/Ё/Ю/Я → Ъ",
    rule:
      "После приставки, оканчивающейся на согласный, перед Е, Ё, Ю, Я пишется «Ъ».",
    examples: [
      "подъезд",
      "объём",
      "предъюбилейный",
      "разъём",
      "съёмка",
      "сверхъестественный",
      "межъязыковой",
      "разъярённый",
    ],
    exceptions: [
      "Исключений нет: если перед Е/Ё/Ю/Я стоит приставка на согласный, пишем «Ъ».",
      "Следите за корнями типа «дья-»: подьячий — «Ь» внутри корня, а не после приставки.",
    ],
    source: FIPI_SPEC_2025,
    extra:
      "Раздел 10 спецификации подчёркивает проверку написаний приставка + Е/Ё/Ю/Я, включая приставки меж-, сверх-, раз- и т. д.",
  },
  "hard-sign-foreign-prefixoids": {
    title: "Ъ в иноязычных элементах",
    mapping: "ад-/ин-/кон-/об-/суб-/контр-/пан-/транс- + Е/Ё/Ю/Я → Ъ",
    rule:
      "В заимствованных словах после иноязычных элементов (ад-, ин-, интер-, кон-, об-, суб-, контр-, пан-, транс-, диз-) перед Е/Ё/Ю/Я пишется «Ъ».",
    examples: [
      "адъютант",
      "инъекция",
      "конъюнктура",
      "объект",
      "субъективный",
      "контръядерный",
      "панъевропейский",
      "трансъевропейский",
      "дизъюнкция",
    ],
    exceptions: [
      "Закрепившиеся написания с корнем на «-ь» (например, бильярд, мильярд) не относятся к приставкам — это отдельные корни.",
      "Сокращения («инъяз») подчиняются тому же правилу.",
    ],
    source: FIPI_SPEC_2025,
    extra:
      "Спецификация фиксирует контроль написаний с иноязычными приставочными элементами (задание 10).",
  },
  "hard-sign-numerals": {
    title: "Ъ после числительных-частей",
    mapping: "двух-/трёх-/четырёх- + Е/Ё/Ю/Я → Ъ",
    rule:
      "В сложных словах с основами числительных двух-, трёх-, четырёх- перед Е/Ё/Ю/Я пишем «Ъ».",
    examples: [
      "двухъярусный",
      "двухъязычный",
      "трёхъязычный",
      "трёхъярусный",
      "четырёхъядерный",
      "четырёхъярусный",
    ],
    exceptions: [
      "Если после числительной основы идёт И, используем «Ь»: двуимпульсный.",
    ],
    source: FIPI_SPEC_2025,
  },
  "soft-sign-not-after-prefix": {
    title: "Ь не после приставки",
    mapping: "не после приставки + Е/Ё/Ю/Я/И → Ь (разделит.)",
    rule:
      "Во всех остальных позициях (в корне, между корнем и суффиксом, в окончаниях) перед Е, Ё, Ю, Я, И пишется «Ь» как разделительный. Для части заимствованных слов сохраняется «Ь» перед О.",
    examples: [
      "вьюга",
      "пьеса",
      "семья",
      "соловьи",
      "льётся",
      "обезьяна",
      "вьюнок",
      "интервью",
      "шампиньон",
      "бульон",
      "павильон",
      "фьорд",
    ],
    exceptions: [
      "Группа заимствованных слов с «Ь» перед О: батальон, павильон, бульон, медальон, шампиньон, каньон, почтальон и др.",
      "В сочетаниях типа фьорд, фьёль, фьордовый «Ь» сохраняется по традиции.",
    ],
    source: FIPI_SPEC_2025,
    extra:
      "ФИПИ контролирует орфограмму разделительных знаков и заимствованных сочетаний (см. раздел 10 спецификации).",
  },
  tricky: {
    title: "Исключения и ловушки",
    mapping: "Смотрим морфемный разбор и традицию",
    rule:
      "Ловушки: исторические написания и случаи, где «Ь» внутри корня (подьячий) или традиционный «Ъ» (изъян).",
    examples: [
      "изъян",
      "подьячий",
      "разъярённый",
      "межъязыковой",
      "фельдъегерь",
      "объятья",
    ],
    exceptions: [
      "подьячий (корень «дья-» → «Ь» внутри корня)",
      "изъян (исторически закреплённое «Ъ» в корне)",
      "объятий/объятья (глагол «объять» сохраняет «Ъ» во всех формах)",
    ],
    source: FIPI_SPEC_2025,
  },
};

const REGULAR_ITEMS: Item[] = [
  // Ъ после приставки
  { id: "pfx1", masked: "под?езд", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "После приставки на согласную перед Е — «Ъ»." },
  { id: "pfx2", masked: "об?ём", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "После приставки на согласную перед Ё — «Ъ»." },
  { id: "pfx3", masked: "пред?юбилейный", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "После приставки на согласную перед Ю — «Ъ»." },
  { id: "pfx4", masked: "раз?ём", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "После приставки на согласную перед Ё — «Ъ»." },
  { id: "pfx5", masked: "с?езд", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "После приставки на согласную перед Е — «Ъ»." },
  { id: "pfx6", masked: "раз?яснить", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "После приставки на согласную перед Я — «Ъ»." },
  { id: "pfx7", masked: "пред?явить", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "После приставки на согласную перед Я — «Ъ»." },
  { id: "pfx8", masked: "меж?языковой", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "Приставка меж- + Я — «Ъ»." },
  { id: "pfx9", masked: "сверх?естественный", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "Приставка сверх- + Е — «Ъ»." },

  // Ъ в иноязычных элементах
  { id: "fx1", masked: "ад?ютант", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После иноязычного элемента ад- перед Ю — «Ъ»." },
  { id: "fx2", masked: "ин?екция", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После иноязычного элемента ин- перед Е — «Ъ»." },
  { id: "fx3", masked: "кон?юнктура", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После иноязычного элемента кон- перед Ю — «Ъ»." },
  { id: "fx4", masked: "об?ект", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После иноязычного элемента об- перед Е — «Ъ»." },
  { id: "fx5", masked: "суб?ективный", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После иноязычного элемента суб- перед Е — «Ъ»." },
  { id: "fx6", masked: "контр?ядерный", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После контр- перед Я — «Ъ»." },
  { id: "fx7", masked: "пан?европейский", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После пан- перед Е — «Ъ»." },
  { id: "fx8", masked: "транс?европейский", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После транс- перед Е — «Ъ»." },
  { id: "fx9", masked: "диз?юнкция", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "После диз- перед Ю — «Ъ»." },

  // Ъ после числительных-частей
  { id: "num1", masked: "двух?ярусный", answer: "Ъ", ruleId: "hard-sign-numerals", why: "После двух- перед Я — «Ъ»." },
  { id: "num2", masked: "трёх?язычный", answer: "Ъ", ruleId: "hard-sign-numerals", why: "После трёх- перед Я — «Ъ»." },
  { id: "num3", masked: "четырёх?ядерный", answer: "Ъ", ruleId: "hard-sign-numerals", why: "После четырёх- перед Я — «Ъ»." },

  // Ь (не после приставки)
  { id: "soft1", masked: "в?ётся", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "Не после приставки перед Ё — «Ь»." },
  { id: "soft2", masked: "в?юга", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "Не после приставки перед Ю — «Ь»." },
  { id: "soft3", masked: "обез?яна", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "В корне перед Я — «Ь»." },
  { id: "soft4", masked: "сем?я", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "В корне перед Я — «Ь»." },
  { id: "soft5", masked: "солов?и", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "В окончании перед И — «Ь»." },
  { id: "soft6", masked: "п?еса", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "В корне перед Е — «Ь»." },
  { id: "soft7", masked: "бар?ер", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "В корне перед Е — «Ь»." },
  { id: "soft8", masked: "шампин?он", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "Заимств. слова: перед О — «Ь»." },
  { id: "soft9", masked: "батал?он", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "Заимств. слова: перед О — «Ь»." },
  { id: "soft10", masked: "интерв?ю", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "Не после приставки перед Ю — «Ь»." },
  { id: "soft11", masked: "ль?ётся", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "В корне/форме перед Ё — «Ь»." },
  { id: "soft12", masked: "ф?орд", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "Традиционное сочетание «ЬО» в заимств. слове." },

  // Трудные
  { id: "tr1", masked: "из?ян", answer: "Ъ", ruleId: "tricky", why: "Традиция: пишется «Ъ»." },
  { id: "tr2", masked: "под?ячий", answer: "Ь", ruleId: "tricky", why: "«Дьяк» → корень с «Ь», не после приставки." },
  { id: "tr3", masked: "раз?ярённый", answer: "Ъ", ruleId: "tricky", why: "После приставки на согласную перед Я — «Ъ»." },
  { id: "tr4", masked: "меж?юбилейный", answer: "Ъ", ruleId: "tricky", why: "Приставка меж- + Ю — «Ъ»." },
  { id: "tr5", masked: "фельд?егерь", answer: "Ъ", ruleId: "tricky", why: "Исторически приставочный элемент + Е — «Ъ»." },
  { id: "tr6", masked: "об?ятия", answer: "Ъ", ruleId: "tricky", why: "Глагол «объять» → «Ъ» сохраняется." },
];

const HARD_ITEMS: Item[] = [
  // Сосредоточимся на ловушках
  { id: "h1", masked: "под?ячий", answer: "Ь", ruleId: "tricky", why: "От «дьяк»: «Ь» в корне." },
  { id: "h2", masked: "из?ян", answer: "Ъ", ruleId: "tricky", why: "Традиционное написание: «Ъ»." },
  { id: "h3", masked: "пан?европейский", answer: "Ъ", ruleId: "hard-sign-foreign-prefixoids", why: "Иноязыч. элемент пан- + Е → «Ъ»." },
  { id: "h4", masked: "двух?ярусный", answer: "Ъ", ruleId: "hard-sign-numerals", why: "После двух- перед Я — «Ъ»." },
  { id: "h5", masked: "шампин?он", answer: "Ь", ruleId: "soft-sign-not-after-prefix", why: "Исключительная группа: «Ь» перед О." },
  { id: "h6", masked: "раз?яснение", answer: "Ъ", ruleId: "hard-sign-after-prefix", why: "После приставки на согласную перед Я — «Ъ»." },
  { id: "h7", masked: "фельд?егерь", answer: "Ъ", ruleId: "tricky", why: "Историческое написание с «Ъ»." },
];

const EXAM_QUESTION: ExamQuestion = {
  id: "ege-task-10-2025",
  title: "ЕГЭ, задание 10: разделительные Ъ/Ь",
  prompt:
    "Укажите варианты ответов, в которых во всех словах одного ряда пропущена одна и та же буква. Запишите номера ответов.",
  options: [
    {
      id: "1",
      shouldSelect: true,
      words: [
        {
          masked: "под?ём",
          expected: "Ъ",
          ruleId: "hard-sign-after-prefix",
          explanation: "подъём — приставка под- + Ё → «Ъ».",
        },
        {
          masked: "меж?языковой",
          expected: "Ъ",
          ruleId: "hard-sign-after-prefix",
          explanation: "межъязыковой — приставка меж- + Я → «Ъ».",
        },
        {
          masked: "из?ян",
          expected: "Ъ",
          ruleId: "tricky",
          explanation: "изъян — историческое написание с «Ъ» в корне.",
        },
      ],
      explanation: "Во всех словах вставляется «Ъ»: приставка на согласный + гласная либо историческое написание (изъян).",
    },
    {
      id: "2",
      shouldSelect: false,
      words: [
        {
          masked: "в?ётся",
          expected: "Ь",
          ruleId: "soft-sign-not-after-prefix",
          explanation: "вьётся — не приставка, «Ь» разделяет звук перед Ё.",
        },
        {
          masked: "ад?ютант",
          expected: "Ъ",
          ruleId: "hard-sign-foreign-prefixoids",
          explanation: "адъютант — латинский элемент ад- + Ю → «Ъ».",
        },
        {
          masked: "раз?ярённый",
          expected: "Ъ",
          ruleId: "hard-sign-after-prefix",
          explanation: "разъярённый — приставка раз- + Я → «Ъ».",
        },
      ],
      explanation: "Буквы разные: первое слово требует «Ь», остальные — «Ъ», поэтому ряд неверный.",
    },
    {
      id: "3",
      shouldSelect: true,
      words: [
        {
          masked: "пан?европейский",
          expected: "Ъ",
          ruleId: "hard-sign-foreign-prefixoids",
          explanation: "панъевропейский — элемент пан- + Е → «Ъ».",
        },
        {
          masked: "контр?ядерный",
          expected: "Ъ",
          ruleId: "hard-sign-foreign-prefixoids",
          explanation: "контръядерный — контр- + Я → «Ъ».",
        },
        {
          masked: "ад?ютант",
          expected: "Ъ",
          ruleId: "hard-sign-foreign-prefixoids",
          explanation: "адъютант — ад- + Ю → «Ъ».",
        },
      ],
      explanation: "Все слова требуют «Ъ» после иноязычных элементов.",
    },
    {
      id: "4",
      shouldSelect: true,
      words: [
        {
          masked: "интерв?ю",
          expected: "Ь",
          ruleId: "soft-sign-not-after-prefix",
          explanation: "интервью — «Ь» перед Ю в середине слова.",
        },
        {
          masked: "шампин?он",
          expected: "Ь",
          ruleId: "soft-sign-not-after-prefix",
          explanation: "шампиньон — традиционное «ЬО» в заимствовании.",
        },
        {
          masked: "буль?он",
          expected: "Ь",
          ruleId: "soft-sign-not-after-prefix",
          explanation: "бульон — «Ь» перед О в заимствованном слове.",
        },
      ],
      explanation: "Во всех словах пишется разделительный «Ь» (в том числе перед О в заимствованиях).",
    },
    {
      id: "5",
      shouldSelect: false,
      words: [
        {
          masked: "обез?яна",
          expected: "Ь",
          ruleId: "soft-sign-not-after-prefix",
          explanation: "обезьяна — «Ь» внутри корня перед Я.",
        },
        {
          masked: "в?юга",
          expected: "Ь",
          ruleId: "soft-sign-not-after-prefix",
          explanation: "вьюга — разделительный «Ь» перед Ю в корне.",
        },
        {
          masked: "фельд?егерь",
          expected: "Ъ",
          ruleId: "tricky",
          explanation: "фельдъегерь — историческое «Ъ» после приставочного элемента feld-.",
        },
      ],
      explanation: "Два слова требуют «Ь», но «фельдъегерь» пишется через «Ъ», поэтому ряд неверный.",
    },
  ],
  source: FIPI_SPEC_2025,
  note: "Формат и проверяемое правило соответствуют пункту 10 спецификации ФИПИ для ЕГЭ-2025.",
};

// ===== UI =====

type DeckKey = "all" | RuleId;

type TabKey = "practice" | "hard" | "exam" | "rules";

export default function HardSoftSignTrainer() {
  const [tab, setTab] = useState<TabKey>("practice");
  const [deck, setDeck] = useState<DeckKey>("all");
  const [autoShowRule, setAutoShowRule] = useState(true);

  const baseList = tab === "hard" ? HARD_ITEMS : REGULAR_ITEMS;
  const filtered = useMemo(
    () =>
      deck === "all"
        ? baseList
        : baseList.filter((item) => item.ruleId === deck),
    [baseList, deck],
  );

  const [queue, setQueue] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [lastAnswerRight, setLastAnswerRight] = useState<boolean | null>(null);

  const [examSelection, setExamSelection] = useState<Set<string>>(new Set());
  const [examChecked, setExamChecked] = useState(false);
  const [examIsRight, setExamIsRight] = useState<boolean | null>(null);

  useEffect(() => {
    if (tab === "practice" || tab === "hard") {
      const q = shuffleArray(filtered);
      setQueue(q);
      setIdx(0);
      setDone(0);
      setCorrect(0);
      setRevealed(false);
      setLastAnswerRight(null);
    }
  }, [filtered, tab]);

  useEffect(() => {
    if (tab === "exam") {
      setExamSelection(new Set());
      setExamChecked(false);
      setExamIsRight(null);
    }
  }, [tab]);

  const current = queue[idx];
  const ruleCard = current ? RULES[current.ruleId] : null;

  function answer(letter: Letter) {
    if (!current) return;
    const isRight = letter === current.answer;
    setLastAnswerRight(isRight);
    if (isRight) setCorrect((c) => c + 1);
    setRevealed(true);
  }

  function next() {
    const nextIdx = idx + 1;
    setDone((d) => d + 1);
    setRevealed(false);
    setLastAnswerRight(null);
    if (nextIdx >= queue.length) {
      const q = shuffleArray(filtered);
      setQueue(q);
      setIdx(0);
    } else {
      setIdx(nextIdx);
    }
  }

  function resetAll() {
    const q = shuffleArray(filtered);
    setQueue(q);
    setIdx(0);
    setDone(0);
    setCorrect(0);
    setRevealed(false);
    setLastAnswerRight(null);
  }

  const progress = queue.length ? (done / queue.length) * 100 : 0;

  function toggleExamOption(id: string) {
    setExamSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function checkExam() {
    const correctSet = new Set(
      EXAM_QUESTION.options.filter((opt) => opt.shouldSelect).map((opt) => opt.id),
    );
    const selectedSet = examSelection;
    let ok = true;
    if (selectedSet.size !== correctSet.size) {
      ok = false;
    } else {
      for (const id of selectedSet) {
        if (!correctSet.has(id)) {
          ok = false;
          break;
        }
      }
    }
    setExamIsRight(ok);
    setExamChecked(true);
  }

  function resetExamSelection() {
    setExamSelection(new Set());
    setExamChecked(false);
    setExamIsRight(null);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Приставки + разделительные Ъ/Ь — тренажёр (ЕГЭ)
          </h1>
          <p className="text-sm text-muted-foreground">
            Правило из спецификации ФИПИ: после приставки на согласную перед Е/Ё/Ю/Я — «Ъ»; во всех прочих позициях перед Е/Ё/Ю/Я/И — «Ь» (есть группа заимствованных слов с «Ь» перед О). Специальные случаи: иноязычные элементы (ад-, ин-, кон-, об-, суб-, контр-, пан-, транс-), числительные (двух-, трёх-, четырёх-), исторические написания («изъян», «фельдъегерь», «подьячий»).
          </p>
        </div>
        <Button variant="outline" onClick={tab === "exam" ? resetExamSelection : resetAll} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Сбросить
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="practice">Тренировка</TabsTrigger>
          <TabsTrigger value="hard">Исключения (Hard)</TabsTrigger>
          <TabsTrigger value="exam">Формат ЕГЭ</TabsTrigger>
          <TabsTrigger value="rules">Карточки правил</TabsTrigger>
        </TabsList>

        <TabsContent value="practice">
          <DrillCard
            modeLabel="Тренировка"
            deck={deck}
            setDeck={setDeck}
            autoShowRule={autoShowRule}
            setAutoShowRule={setAutoShowRule}
            current={current}
            ruleCard={ruleCard}
            revealed={revealed}
            lastAnswerRight={lastAnswerRight}
            answer={answer}
            next={next}
            correct={correct}
            done={done}
            queueLength={queue.length}
            idx={idx}
            progress={progress}
            tab={tab}
          />
        </TabsContent>

        <TabsContent value="hard">
          <DrillCard
            modeLabel="Исключения"
            deck={deck}
            setDeck={setDeck}
            autoShowRule={autoShowRule}
            setAutoShowRule={setAutoShowRule}
            current={current}
            ruleCard={ruleCard}
            revealed={revealed}
            lastAnswerRight={lastAnswerRight}
            answer={answer}
            next={next}
            correct={correct}
            done={done}
            queueLength={queue.length}
            idx={idx}
            progress={progress}
            tab={tab}
          />
        </TabsContent>

        <TabsContent value="exam">
          <ExamCard
            question={EXAM_QUESTION}
            selection={examSelection}
            toggleOption={toggleExamOption}
            check={checkExam}
            reset={resetExamSelection}
            checked={examChecked}
            isRight={examIsRight}
          />
        </TabsContent>

        <TabsContent value="rules">
          <RulesGrid rules={RULES} />
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-xs text-muted-foreground">
        Хочешь добавить свои «ловушки» из вариантов ЕГЭ? Напиши — внесу в наборы.
      </div>
    </div>
  );
}

function DrillCard({
  modeLabel,
  deck,
  setDeck,
  autoShowRule,
  setAutoShowRule,
  current,
  ruleCard,
  revealed,
  lastAnswerRight,
  answer,
  next,
  correct,
  done,
  queueLength,
  idx,
  progress,
  tab,
}: {
  modeLabel: string;
  deck: DeckKey;
  setDeck: (v: DeckKey) => void;
  autoShowRule: boolean;
  setAutoShowRule: (v: boolean) => void;
  current?: Item;
  ruleCard: RuleCard | null;
  revealed: boolean;
  lastAnswerRight: boolean | null;
  answer: (letter: Letter) => void;
  next: () => void;
  correct: number;
  done: number;
  queueLength: number;
  idx: number;
  progress: number;
  tab: TabKey;
}) {
  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-xl">Режим: {modeLabel}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {deckLabel(deck)}
            </Badge>
            <Badge className="text-xs">Без повторов</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={autoShowRule} onCheckedChange={setAutoShowRule} />
              <span className="text-sm text-muted-foreground">
                Показывать правило после ответа
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Набор:</span>
          <DeckButton here={deck} set={setDeck} val="all" label="Все" />
          <DeckButton
            here={deck}
            set={setDeck}
            val="hard-sign-after-prefix"
            label="Ъ после приставки"
          />
          <DeckButton
            here={deck}
            set={setDeck}
            val="hard-sign-foreign-prefixoids"
            label="Ъ иноязыч."
          />
          <DeckButton
            here={deck}
            set={setDeck}
            val="hard-sign-numerals"
            label="Ъ после числит."
          />
          <DeckButton
            here={deck}
            set={setDeck}
            val="soft-sign-not-after-prefix"
            label="Ь (не после приставки)"
          />
          <DeckButton here={deck} set={setDeck} val="tricky" label="Ловушки" />
        </div>

        <Progress value={progress} className="h-2" />

        {current ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
                Выберите знак
              </div>
              <div className="text-3xl md:text-5xl font-bold mb-4">{current.masked}</div>
              <div className="flex justify-center gap-3">
                <Button size="lg" className="text-xl px-8" onClick={() => answer("Ъ")}>
                  Ъ
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-xl px-8"
                  onClick={() => answer("Ь")}
                >
                  Ь
                </Button>
              </div>
            </div>

            {revealed && (
              <div
                className={`rounded-2xl border p-4 md:p-5 ${
                  lastAnswerRight ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium mb-2">
                  {lastAnswerRight ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" /> Верно!
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5" /> Неверно
                    </>
                  )}
                </div>
                <div className="text-lg">
                  Правильно: <span className="font-semibold">{fillMasked(current.masked, current.answer)}</span>
                </div>
                {ruleCard && (
                  <div className="mt-3 text-sm leading-relaxed">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="h-4 w-4" />
                      <span className="font-medium">Алгоритм ({ruleCard.title}):</span>
                    </div>
                    <div>
                      <span className="font-semibold">{ruleCard.mapping}</span> → {current.why}
                    </div>
                    <RuleSourceBadge source={ruleCard.source} />
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <Button onClick={next} className="gap-2">
                    Дальше
                  </Button>
                </div>
              </div>
            )}

            {!revealed && autoShowRule === false && (
              <div className="rounded-2xl border p-4 md:p-5 bg-muted/40">
                <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
                  <Lightbulb className="h-4 w-4" /> Подсказка (коротко)
                </div>
                <div className="text-sm">
                  <span className="font-semibold">{ruleCard?.title}:</span> {ruleCard?.mapping} → {ruleCard?.rule}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div>
                Очки: <span className="font-semibold">{correct}</span> / {done}
              </div>
              <div>
                Осталось в раунде: <span className="font-semibold">{queueLength - idx - (revealed ? 0 : 1)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">Нет слов в выбранном наборе.</div>
        )}
      </CardContent>
    </Card>
  );
}

function ExamCard({
  question,
  selection,
  toggleOption,
  check,
  reset,
  checked,
  isRight,
}: {
  question: ExamQuestion;
  selection: Set<string>;
  toggleOption: (id: string) => void;
  check: () => void;
  reset: () => void;
  checked: boolean;
  isRight: boolean | null;
}) {
  return (
    <Card className="mt-4">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" /> Формат ЕГЭ (задание 10)
          </div>
          <CardTitle>{question.title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {question.prompt}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          <RuleSourceBadge source={question.source} note={question.note} />
        </div>
        <div className="space-y-3">
          {question.options.map((option) => {
            const isSelected = selection.has(option.id);
            const shouldSelect = option.shouldSelect;
            let status: "idle" | "correct" | "wrong" = "idle";
            if (checked) {
              if (isSelected && shouldSelect) status = "correct";
              else if (!isSelected && shouldSelect) status = "wrong";
              else if (isSelected && !shouldSelect) status = "wrong";
            }
            return (
              <div
                key={option.id}
                className={`rounded-xl border p-4 transition-colors ${
                  status === "correct"
                    ? "border-green-300 bg-green-50"
                    : status === "wrong"
                      ? "border-red-300 bg-red-50"
                      : "border-muted"
                }`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => toggleOption(option.id)}
                      className="w-10 h-10 p-0"
                    >
                      {option.id}
                    </Button>
                    <div className="text-sm md:text-base font-medium">
                      {option.words.map((word, idx) => (
                        <span key={word.masked}>
                          {word.masked}
                          {idx < option.words.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {checked && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="font-medium text-muted-foreground">Разбор:</div>
                    <ul className="space-y-1 text-sm">
                      {option.words.map((word) => (
                        <li key={word.masked} className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {fillMasked(word.masked, word.expected)}
                          </Badge>
                          <span>{word.explanation}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="text-sm font-medium">{option.explanation}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {checked && isRight !== null && (
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                  isRight ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {isRight ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Ответ верный
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> Есть неточности
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              Очистить выбор
            </Button>
            <Button onClick={check} className="gap-2">
              Проверить
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RulesGrid({ rules }: { rules: Record<RuleId, RuleCard> }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        {(Object.keys(rules) as RuleId[]).map((rid) => (
          <Card key={rid} className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{rules[rid].title}</CardTitle>
              <CardDescription className="text-sm">{rules[rid].mapping}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{rules[rid].rule}</p>
              {rules[rid].extra ? <p className="text-muted-foreground">{rules[rid].extra}</p> : null}
              {rules[rid].examples?.length ? (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Примеры</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {rules[rid].examples.map((e) => (
                      <Badge key={e} variant="secondary">
                        {e}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {rules[rid].exceptions?.length ? (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Исключения</div>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    {rules[rid].exceptions!.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <RuleSourceBadge source={rules[rid].source} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardContent className="text-sm text-muted-foreground p-4 space-y-2">
          <p>
            Подсказка для ЕГЭ: сначала проверь, есть ли приставка на согласный прямо перед Е/Ё/Ю/Я — тогда по спецификации гарантирован «Ъ». Если приставки нет, по умолчанию пишем «Ь», но учитываем заимствованные сочетания («-ЬО-») и исторические написания («подьячий», «изъян», «фельдъегерь»).
          </p>
          <RuleSourceBadge source={FIPI_SPEC_2025} note="Раздел 10: «Употребление ъ и ь (в том числе разделительных)»" />
        </CardContent>
      </Card>
    </div>
  );
}

function DeckButton({ here, set, val, label }: { here: DeckKey; set: (v: DeckKey) => void; val: DeckKey; label: string }) {
  const active = here === val;
  return (
    <Button variant={active ? "default" : "outline"} size="sm" onClick={() => set(val)} className="gap-2">
      {active && <Shuffle className="h-4 w-4" />} {label}
    </Button>
  );
}

function deckLabel(d: DeckKey) {
  switch (d) {
    case "all":
      return "Все наборы";
    case "hard-sign-after-prefix":
      return "Ъ после приставки";
    case "hard-sign-foreign-prefixoids":
      return "Ъ в иноязычных";
    case "hard-sign-numerals":
      return "Ъ после числит.";
    case "soft-sign-not-after-prefix":
      return "Ь не после приставки";
    case "tricky":
      return "Ловушки";
  }
}

function RuleSourceBadge({ source, note }: { source: RuleSource; note?: string }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
    >
      <ExternalLink className="h-3 w-3" /> {source.label}
      {source.note ? ` (${source.note})` : null}
      {note ? ` • ${note}` : null}
    </a>
  );
}
