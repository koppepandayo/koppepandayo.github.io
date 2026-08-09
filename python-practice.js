"use strict";

const PROBLEMS = [
  {
    id: "hello",
    category: "基礎文法",
    title: "Hello, World!",
    difficulty: 1,
    description: "「Hello, World!」という文字列を1行で出力してください。\n\n入力はありません。",
    lesson:
      "Pythonでは print(...) で画面に文字を出力します。文字列は \"...\" または\n" +
      "'...' で囲みます。Javaと違ってクラスやmainメソッドは不要で、\n" +
      "書いたコードがそのまま上から実行されます。\n\n" +
      "例:\nprint(\"こんにちは\")",
    starter: "# ここに書いてください\n",
    tests: [{ stdin: "", expected: "Hello, World!" }],
  },
  {
    id: "add",
    category: "変数と演算",
    title: "2つの整数の和",
    difficulty: 1,
    description:
      "標準入力から半角スペース区切りで整数 a と b が与えられます。\n" +
      "a + b の値を出力してください。\n\n入力例: 3 5\n出力例: 8",
    lesson:
      "標準入力から1行読み込むには input() を使います。整数に変換するには\n" +
      "int(...) を使います。半角スペース区切りの複数の値は .split() で\n" +
      "分割してからそれぞれ変換します。\n\n" +
      "例:\nx, y = input().split()\nx = int(x)\ny = int(y)\nprint(x + y)\n\n" +
      "まとめて書くと x, y = map(int, input().split()) とも書けます。",
    starter: "a, b = map(int, input().split())\n# ここに書いてください\n",
    tests: [
      { stdin: "3 5", expected: "8" },
      { stdin: "10 20", expected: "30" },
      { stdin: "-5 5", expected: "0" },
    ],
  },
  {
    id: "even_odd",
    category: "条件分岐",
    title: "偶数か奇数か",
    difficulty: 1,
    description:
      "標準入力から整数 n が与えられます。\n" +
      "n が偶数なら \"Even\"、奇数なら \"Odd\" を出力してください。",
    lesson:
      "条件分岐は if 条件: ... elif 条件: ... else: ... で書きます。\n" +
      "Javaと違って波括弧{}は使わず、インデント(字下げ)でブロックを\n" +
      "表します。比較演算子は ==, !=, <, > など。\n\n" +
      "例:\nscore = 75\nif score >= 60:\n    print(\"合格\")\nelse:\n    print(\"不合格\")",
    starter: "n = int(input())\n# ここに書いてください\n",
    tests: [
      { stdin: "4", expected: "Even" },
      { stdin: "7", expected: "Odd" },
      { stdin: "0", expected: "Even" },
    ],
  },
  {
    id: "sum_loop",
    category: "ループ",
    title: "1からnまでの合計",
    difficulty: 1,
    description:
      "標準入力から整数 n が与えられます。\n" +
      "1 から n までの整数の合計を for 文または while 文で計算して出力してください。",
    lesson:
      "繰り返しには for 文と range() がよく使われます。range(n) は\n" +
      "0からn-1まで、range(1, n+1) は1からnまでの数列を作ります。\n" +
      "while 条件: も使えます。\n\n" +
      "例:\nfor i in range(3):\n    print(i)\n# 0, 1, 2 が出力される",
    starter: "n = int(input())\ntotal = 0\n# ここに書いてください\n\nprint(total)\n",
    tests: [
      { stdin: "5", expected: "15" },
      { stdin: "1", expected: "1" },
      { stdin: "10", expected: "55" },
    ],
  },
  {
    id: "list_max",
    category: "リスト操作",
    title: "リストの最大値",
    difficulty: 2,
    description:
      "1行目に整数の個数 n、2行目に半角スペース区切りで n 個の整数が与えられます。\n" +
      "リストに格納し、その中の最大値を出力してください(max関数は使わずに書いてみましょう)。\n\n" +
      "入力例:\n5\n3 1 4 1 5\n出力例:\n5",
    lesson:
      "複数の値をまとめて扱うにはリスト[]を使います。\n" +
      "list(map(int, input().split())) で入力を整数のリストに変換\n" +
      "できます。for x in nums: で全要素を順に取り出せます。\n\n" +
      "例:\nnums = [3, 1, 4]\nfor x in nums:\n    print(x)",
    starter:
      "n = int(input())\nnums = list(map(int, input().split()))\n# ここに書いてください\n",
    tests: [
      { stdin: "5\n3 1 4 1 5", expected: "5" },
      { stdin: "3\n-2 -1 -3", expected: "-1" },
      { stdin: "1\n42", expected: "42" },
    ],
  },
  {
    id: "reverse_string",
    category: "文字列操作",
    title: "文字列を逆順にする",
    difficulty: 2,
    description: "標準入力から1行の文字列 s が与えられます。\ns を逆順にして出力してください。",
    lesson:
      "文字列はスライス s[開始:終了:step] で部分的に取り出せます。\n" +
      "s[::-1] はstepに-1を指定することで文字列全体を逆順にする、\n" +
      "よく使われる書き方です。\n\n" +
      "例:\ns = \"abc\"\nprint(s[::-1])  # \"cba\"",
    starter: "s = input()\n# ここに書いてください\n",
    tests: [
      { stdin: "hello", expected: "olleh" },
      { stdin: "java", expected: "avaj" },
      { stdin: "a", expected: "a" },
    ],
  },
  {
    id: "factorial_function",
    category: "関数",
    title: "階乗を計算する関数",
    difficulty: 2,
    description:
      "標準入力から整数 n が与えられます。\n" +
      "n の階乗を計算する関数 factorial(n) を自分で定義し、\n呼び出して結果を出力してください。",
    lesson:
      "関数は def 関数名(引数): で定義し、return で値を返します。\n" +
      "Javaと違い戻り値の型は書きません。\n\n" +
      "例:\ndef square(x):\n    return x * x",
    starter:
      "def factorial(n):\n    # ここに書いてください\n    pass\n\n\nn = int(input())\nprint(factorial(n))\n",
    tests: [
      { stdin: "5", expected: "120" },
      { stdin: "0", expected: "1" },
      { stdin: "6", expected: "720" },
    ],
  },
  {
    id: "fibonacci_recursive",
    category: "再帰",
    title: "フィボナッチ数列(再帰)",
    difficulty: 3,
    description:
      "標準入力から整数 n が与えられます。\n" +
      "フィボナッチ数列 (F(0)=0, F(1)=1, F(n)=F(n-1)+F(n-2)) の n 番目の値を\n" +
      "再帰を使って計算する関数を定義し、結果を出力してください。",
    lesson:
      "関数が自分自身を呼び出すことを再帰と呼びます。再帰には必ず\n" +
      "「それ以上分解しない基本ケース」が必要です。\n\n" +
      "例:\ndef total(n):\n    if n == 0:\n        return 0       # 基本ケース\n" +
      "    return n + total(n - 1)  # 自分自身を呼ぶ",
    starter:
      "def fib(n):\n    # ここに書いてください\n    pass\n\n\nn = int(input())\nprint(fib(n))\n",
    tests: [
      { stdin: "0", expected: "0" },
      { stdin: "1", expected: "1" },
      { stdin: "10", expected: "55" },
    ],
  },
  {
    id: "person_class",
    category: "クラス基礎",
    title: "Personクラス",
    difficulty: 2,
    description:
      "標準入力から半角スペース区切りで名前 name と年齢 age が与えられます。\n" +
      "name と age を持つ Person クラスを定義し、\n" +
      "「名前はNAME、年齢はAGE歳です」という形式(NAME, AGEは実際の値に置き換え)で\n" +
      "出力するメソッドを呼び出してください。\n\n入力例: Taro 20\n出力例: 名前はTaro、年齢は20歳です",
    lesson:
      "クラスは class クラス名: で定義します。コンストラクタは\n" +
      "__init__(self, ...) という特別な名前のメソッドで、インスタンス\n" +
      "生成時に自動で呼ばれます。self は自分自身を指し、\n" +
      "self.name = name のように書くとフィールドになります。\n\n" +
      "例:\nclass Dog:\n    def __init__(self, name):\n        self.name = name\n\n" +
      "    def bark(self):\n        print(self.name + \": わん\")\n\n" +
      "# 使う側: d = Dog(\"ポチ\"); d.bark()",
    starter:
      "class Person:\n    def __init__(self, name, age):\n        # ここに書いてください\n        pass\n\n" +
      "    def introduce(self):\n        # ここに書いてください\n        pass\n\n\n" +
      "name, age = input().split()\nage = int(age)\np = Person(name, age)\np.introduce()\n",
    tests: [
      { stdin: "Taro 20", expected: "名前はTaro、年齢は20歳です" },
      { stdin: "Hanako 25", expected: "名前はHanako、年齢は25歳です" },
    ],
  },
  {
    id: "divide_exception",
    category: "例外処理",
    title: "ゼロ除算の例外処理",
    difficulty: 2,
    description:
      "標準入力から半角スペース区切りで整数 a と b が与えられます。\n" +
      "a を b で割った商(整数除算)を出力してください。\n" +
      "ただし b が 0 の場合は例外を except し、\"Cannot divide by zero\" と出力してください。",
    lesson:
      "エラーが起きそうな処理は try: ... except 例外の型: ... で\n" +
      "囲みます。0で割ると ZeroDivisionError が発生します。\n\n" +
      "例:\ntry:\n    x = 10 // 0\nexcept ZeroDivisionError:\n    print(\"エラーが起きました\")",
    starter: "a, b = map(int, input().split())\n# try/except を使って書いてください\n",
    tests: [
      { stdin: "10 2", expected: "5" },
      { stdin: "10 0", expected: "Cannot divide by zero" },
      { stdin: "9 3", expected: "3" },
    ],
  },
  {
    id: "word_count_dict",
    category: "辞書操作",
    title: "単語の出現回数",
    difficulty: 3,
    description:
      "1行目に単語数 n、2行目に半角スペース区切りで n 個の単語、\n" +
      "3行目に調べたい単語 target が与えられます。\n" +
      "辞書(dict)を使って各単語の出現回数を数え、target の出現回数を出力してください。\n\n" +
      "入力例:\n5\napple banana apple orange apple\napple\n出力例:\n3",
    lesson:
      "キーと値の組を扱うには辞書(dict){}を使います。\n" +
      "d[key] = value で追加・更新、d.get(key, デフォルト値) で\n" +
      "キーが無い場合の値も指定して取得できます。\n\n" +
      "例:\nd = {}\nd[\"apple\"] = 1\nprint(d.get(\"banana\", 0))  # 0",
    starter:
      "n = int(input())\nwords = input().split()\ntarget = input()\ncounts = {}\n# ここに書いてください\n",
    tests: [
      { stdin: "5\napple banana apple orange apple\napple", expected: "3" },
      { stdin: "3\ncat dog cat\ndog", expected: "1" },
      { stdin: "2\nx y\nz", expected: "0" },
    ],
  },
  {
    id: "fizzbuzz",
    category: "総合問題",
    title: "FizzBuzz",
    difficulty: 2,
    description:
      "標準入力から整数 n が与えられます。\n" +
      "1 から n まで、3の倍数のときは \"Fizz\"、5の倍数のときは \"Buzz\"、\n" +
      "両方の倍数のときは \"FizzBuzz\"、それ以外はその数値を1行ずつ出力してください。",
    lesson:
      "これまで学んだ for 文・if 文・剰余演算子(%)を組み合わせて解く\n" +
      "総合問題です。複数の条件を順に判定するときは if / elif / else を\n" +
      "使い、より狭い条件(15の倍数)を先に判定するのがポイントです。",
    starter: "n = int(input())\n# ここに書いてください\n",
    tests: [
      { stdin: "5", expected: "1\n2\nFizz\n4\nBuzz" },
      {
        stdin: "15",
        expected: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
      },
    ],
  },
];

const STORAGE_KEY = "pp-progress";

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { solved: [], codes: {} };
    const data = JSON.parse(raw);
    return { solved: data.solved || [], codes: data.codes || {} };
  } catch (e) {
    return { solved: [], codes: {} };
  }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function markSolved(id) {
  const data = loadProgress();
  if (!data.solved.includes(id)) data.solved.push(id);
  saveProgress(data);
  return data;
}

function saveCode(id, code) {
  const data = loadProgress();
  data.codes[id] = code;
  saveProgress(data);
}

function normalize(text) {
  let lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  lines = lines.map((l) => l.replace(/[ \t]+$/, ""));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

let pyodideInstance = null;
let currentProblem = null;
let progressData = loadProgress();
let running = false;

const el = {
  loading: document.getElementById("pp-loading"),
  loadingText: document.getElementById("pp-loading-text"),
  app: document.getElementById("pp-app"),
  list: document.getElementById("pp-problem-list"),
  title: document.getElementById("pp-title"),
  difficulty: document.getElementById("pp-difficulty"),
  lesson: document.getElementById("pp-lesson"),
  description: document.getElementById("pp-description"),
  code: document.getElementById("pp-code"),
  resetBtn: document.getElementById("pp-reset-btn"),
  runBtn: document.getElementById("pp-run-btn"),
  status: document.getElementById("pp-status"),
  result: document.getElementById("pp-result"),
};

function labelFor(problem) {
  const mark = progressData.solved.includes(problem.id) ? "✓ " : "";
  return `${mark}${problem.title}`;
}

function renderList() {
  const categories = {};
  for (const p of PROBLEMS) {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  }

  el.list.innerHTML = "";
  for (const [category, plist] of Object.entries(categories)) {
    const catEl = document.createElement("div");
    catEl.className = "pp-category";
    const catTitle = document.createElement("div");
    catTitle.className = "pp-category-title";
    catTitle.textContent = category;
    catEl.appendChild(catTitle);

    for (const p of plist) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "pp-problem-item";
      item.dataset.id = p.id;
      item.textContent = labelFor(p);
      if (currentProblem && currentProblem.id === p.id) item.classList.add("active");
      item.addEventListener("click", () => selectProblem(p.id));
      catEl.appendChild(item);
    }
    el.list.appendChild(catEl);
  }
}

function selectProblem(id) {
  if (currentProblem) {
    saveCode(currentProblem.id, el.code.value);
  }
  const problem = PROBLEMS.find((p) => p.id === id);
  if (!problem) return;
  currentProblem = problem;

  el.title.textContent = problem.title;
  el.difficulty.textContent = "難易度: " + "★".repeat(problem.difficulty);
  el.lesson.textContent = problem.lesson;
  el.description.textContent = problem.description;

  const saved = progressData.codes[id];
  el.code.value = saved !== undefined ? saved : problem.starter;
  el.code.disabled = false;
  el.runBtn.disabled = false;

  el.status.textContent = "";
  el.result.innerHTML = "";

  renderList();
}

function setStatus(text) {
  el.status.textContent = text;
}

function renderResults(results) {
  el.result.innerHTML = "";
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const box = document.createElement("div");
    box.className = "pp-test-result " + (r.passed ? "pp-test-pass" : "pp-test-fail");

    const head = document.createElement("div");
    head.className = "pp-test-head";
    head.textContent = (r.passed ? "✅ " : "❌ ") + `テスト${i + 1}`;
    box.appendChild(head);

    const stdinLine = document.createElement("div");
    stdinLine.className = "pp-test-line";
    stdinLine.textContent = `入力: ${JSON.stringify(r.stdin)}`;
    box.appendChild(stdinLine);

    const expLine = document.createElement("div");
    expLine.className = "pp-test-line";
    expLine.textContent = `期待される出力: ${JSON.stringify(r.expected)}`;
    box.appendChild(expLine);

    if (!r.passed) {
      const actLine = document.createElement("div");
      actLine.className = "pp-test-line";
      actLine.textContent = `実際の出力: ${JSON.stringify(r.actual)}`;
      box.appendChild(actLine);

      if (r.error) {
        const errLine = document.createElement("pre");
        errLine.className = "pp-test-error";
        errLine.textContent = r.error;
        box.appendChild(errLine);
      }
    }

    el.result.appendChild(box);
  }
}

function isSyntaxError(message) {
  return /SyntaxError/.test(message);
}

// setStdin({string: ...}) はこのPyodideビルドではI/Oエラーになるため、
// 1行ずつ返すコールバック形式でstdinを供給する。
function makeStdinProvider(stdinText) {
  const lines = stdinText.split("\n");
  let i = 0;
  return () => (i < lines.length ? lines[i++] : null);
}

async function runOneTest(code, test) {
  const outputLines = [];
  let errorMessage = "";

  pyodideInstance.setStdout({
    batched: (msg) => outputLines.push(msg),
  });
  pyodideInstance.setStderr({
    batched: (msg) => {},
  });
  pyodideInstance.setStdin({ stdin: makeStdinProvider(test.stdin) });

  const globals = pyodideInstance.globals.get("dict")();
  try {
    pyodideInstance.runPython(code, { globals });
  } catch (e) {
    errorMessage = e && e.message ? e.message : String(e);
  } finally {
    globals.destroy();
  }

  const actual = outputLines.join("\n");
  const passed = !errorMessage && normalize(actual) === normalize(test.expected);

  return {
    stdin: test.stdin,
    expected: test.expected,
    actual,
    passed,
    error: errorMessage,
  };
}

async function runTests() {
  if (!currentProblem || running) return;
  running = true;
  el.runBtn.disabled = true;
  el.resetBtn.disabled = true;
  setStatus("実行中...");
  el.result.innerHTML = "";

  const code = el.code.value;
  saveCode(currentProblem.id, code);

  const results = [];
  let stoppedForSyntaxError = false;

  for (const test of currentProblem.tests) {
    const result = await runOneTest(code, test);
    results.push(result);
    if (!result.passed && result.error && isSyntaxError(result.error)) {
      stoppedForSyntaxError = true;
      break;
    }
  }

  renderResults(results);

  const passedCount = results.filter((r) => r.passed).length;
  const total = currentProblem.tests.length;

  if (stoppedForSyntaxError) {
    setStatus("構文エラー");
  } else {
    setStatus(`${passedCount}/${total} 件正解`);
    if (passedCount === total) {
      progressData = markSolved(currentProblem.id);
      renderList();
    }
  }

  running = false;
  el.runBtn.disabled = false;
  el.resetBtn.disabled = false;
}

function resetCode() {
  if (!currentProblem) return;
  if (!confirm("コードをスターターコードに戻しますか？")) return;
  el.code.value = currentProblem.starter;
}

async function init() {
  el.runBtn.addEventListener("click", runTests);
  el.resetBtn.addEventListener("click", resetCode);

  renderList();

  try {
    el.loadingText.textContent = "Python実行環境を読み込み中...(初回は少し時間がかかります)";
    pyodideInstance = await loadPyodide();
    el.loading.classList.add("hidden");
    el.app.classList.remove("hidden");
  } catch (e) {
    el.loadingText.textContent =
      "Python実行環境の読み込みに失敗しました。ネットワーク接続を確認して再読み込みしてください。";
  }
}

init();
