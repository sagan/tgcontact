import { InlineKeyboard } from "grammy";

export const CAPTCHA_CODES = [
  "AdDMc",
  "AkKgx",
  "AlwFu",
  "Asjxn",
  "AxMWi",
  "BOoXI",
  "CPeVb",
  "CYURB",
  "DgprN",
  "earlS",
  "EDtCV",
  "eFKLu",
  "eOYrT",
  "eSIdz",
  "EXplI",
  "EXYgv",
  "faALJ",
  "fdZBQ",
  "FGIUH",
  "Flpor",
  "Fyoek",
  "gaSuM",
  "Getag",
  "gmnrd",
  "GPsng",
  "GSaic",
  "gwvFf",
  "GYgia",
  "gYjsJ",
  "hMXpG",
  "htbQc",
  "ilEZh",
  "irfLA",
  "JagIC",
  "JDVFA",
  "JTEHj",
  "JwRMe",
  "jxWlK",
  "KeNEj",
  "KIWnb",
  "KoCie",
  "ktpyz",
  "kuwNB",
  "lBJcS",
  "lnvpd",
  "lRSUQ",
  "LXyJa",
  "mCgzT",
  "mdKPz",
  "MLAgo",
  "NdsKl",
  "nmVNa",
  "nWbet",
  "nZHuJ",
  "OePAM",
  "ofTnM",
  "OISXQ",
  "OPRqu",
  "oSWyY",
  "pBsaJ",
  "pEaLu",
  "pfcdr",
  "pLywk",
  "PSaHb",
  "PtquB",
  "QjMCf",
  "QLisC",
  "qplvW",
  "rAxZB",
  "RcHFg",
  "rDQbB",
  "rTQgs",
  "RxBmh",
  "smByj",
  "sMiXC",
  "TcZJO",
  "tpNnM",
  "tpohz",
  "tpouC",
  "TSRNI",
  "UfWET",
  "UMFrq",
  "UMIHV",
  "uwgCY",
  "UxuTa",
  "vpVOP",
  "wGdkx",
  "wrqeE",
  "WuJPj",
  "WVxEb",
  "XkrZa",
  "xLgWD",
  "XovdI",
  "XQBAT",
  "xrvtc",
  "XumDv",
  "YNlhA",
  "ZBHYs",
  "ZixjX",
  "zuZhH",
];

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateRandomString(length: number = 5): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
  }
  return result;
}

export function getRandomCaptcha(
  origin: string,
  userId: number,
): {
  code: string;
  imageUrl: string;
  keyboard: InlineKeyboard;
} {
  const code = CAPTCHA_CODES[Math.floor(Math.random() * CAPTCHA_CODES.length)];
  const options = new Set<string>();
  options.add(code);

  while (options.size < 8) {
    options.add(generateRandomString(5));
  }

  // Shuffle options
  const shuffled = Array.from(options).sort(() => Math.random() - 0.5);

  const keyboard = new InlineKeyboard();
  for (let i = 0; i < shuffled.length; i++) {
    const opt = shuffled[i];
    keyboard.text(opt, `vcode_${opt}_${userId}`);
    if (i % 4 === 3 && i !== shuffled.length - 1) {
      keyboard.row();
    }
  }

  const imageUrl = `${origin}/captcha/image_${code}.png`;

  return { code, imageUrl, keyboard };
}
