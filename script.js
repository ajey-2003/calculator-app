// ==============================
// ELEMENTS
// ==============================

const currentDisplay = document.querySelector(".current-display");
const previousDisplay = document.querySelector(".previous-display");
const buttons = document.querySelectorAll(".buttons button");

const historyList = document.getElementById("history-list");
const clearHistoryButton = document.getElementById("clear-history");

const mathField = document.getElementById("mathField");

const calculatorEl = document.getElementById("calculator");
const modeBasicBtn = document.getElementById("mode-basic");
const modeScientificBtn = document.getElementById("mode-scientific");
const sciButtons = document.querySelectorAll(".sci-panel button");


// ==============================
// MODE STATE (Basic / Scientific)
// ==============================

let mode = "basic";


// ==============================
// CALCULATOR STATE (Basic mode)
// ==============================

let currentValue = "0";
let previousValue = "";
let operator = null;
let shouldResetDisplay = false;

let percentageValue = null;
let percentageApplied = false;

let history = [];


// ==============================
// CALCULATOR STATE (Scientific mode)
// ==============================

let sciExpression = "0";
let sciJustEvaluated = false;


// ==============================
// BUTTON CLICK
// ==============================

buttons.forEach(button => {

    button.addEventListener("click", () => {

        const value = button.textContent.trim();

        spawnRipple(button);

        if (mode === "scientific") {
            handleScientificGridButton(value);
        } else {
            handleBasicGridButton(value);
        }

        refreshDisplay();
    });

});


// ==============================
// BASIC GRID HANDLER (unchanged logic)
// ==============================

function handleBasicGridButton(value) {

    // NUMBER
    if (!isNaN(value) || value === ".") {
        enterNumber(value);
    }

    // OPERATOR
    else if (["+", "−", "×", "÷"].includes(value)) {
        chooseOperator(value);
    }

    // EQUALS
    else if (value === "=") {
        calculate();
    }

    // ALL CLEAR
    else if (value === "AC") {
        clearCalculator();
    }

    // DELETE
    else if (value === "⌫") {
        deleteNumber();
    }

    // PERCENTAGE
    else if (value === "%") {
        percentage();
    }

    // PLUS / MINUS
    else if (value === "+/-") {
        toggleSign();
    }
}


// ==============================
// SCIENTIFIC GRID HANDLER
//
// Reuses the same 20 basic-grid buttons, but routes them into
// the expression-based scientific engine instead of the chain
// calculator used in Basic mode.
// ==============================

function handleScientificGridButton(value) {

    if (!isNaN(value) || value === ".") {
        sciInput(value);
    }

    else if (["+", "−", "×", "÷"].includes(value)) {
        sciInput(value);
    }

    else if (value === "=") {
        sciEquals();
    }

    else if (value === "AC") {
        sciClear();
    }

    else if (value === "⌫") {
        sciBackspace();
    }

    // Percentage: treat as "divide the last number by 100",
    // the standard convention on scientific calculators.
    else if (value === "%") {
        wrapLastPrimary(t => `(${t}÷100)`);
    }

    else if (value === "+/-") {
        wrapLastPrimary(t => `(−1×(${t}))`);
    }
}


// ==============================
// SCIENTIFIC PANEL BUTTONS
// ==============================

sciButtons.forEach(button => {

    button.addEventListener("click", () => {

        const value = button.textContent.trim();

        spawnRipple(button);

        switch (value) {

            case "(":
                sciInput("(");
                break;

            case ")":
                sciInput(")");
                break;

            case "π":
                sciInput("π");
                break;

            case "e":
                sciInput("e");
                break;

            case "√":
                sciInput("√(");
                break;

            case "sin":
                sciInput("sin(");
                break;

            case "cos":
                sciInput("cos(");
                break;

            case "tan":
                sciInput("tan(");
                break;

            case "log":
                sciInput("log(");
                break;

            case "ln":
                sciInput("ln(");
                break;

            case "xʸ":
                sciInput("^");
                break;

            case "x²":
                wrapLastPrimary(t => `(${t}^2)`);
                break;

            case "1/x":
                wrapLastPrimary(t => `(1÷(${t}))`);
                break;
        }

        refreshDisplay();
    });

});


// ==============================
// MODE TOGGLE (Basic / Scientific)
// ==============================

function setMode(newMode) {

    mode = newMode;

    calculatorEl.classList.toggle("mode-scientific", mode === "scientific");

    modeBasicBtn.classList.toggle("active", mode === "basic");
    modeScientificBtn.classList.toggle("active", mode === "scientific");

    modeBasicBtn.setAttribute("aria-selected", mode === "basic");
    modeScientificBtn.setAttribute("aria-selected", mode === "scientific");

    refreshDisplay();
}

modeBasicBtn.addEventListener("click", () => setMode("basic"));
modeScientificBtn.addEventListener("click", () => setMode("scientific"));


// ==============================
// DISPLAY DISPATCH
//
// Basic and Scientific modes keep separate state and separate
// display renderers; this picks the right one.
// ==============================

function refreshDisplay() {

    if (mode === "scientific") {
        updateSciDisplay();
    } else {
        updateDisplay();
    }
}


// ==============================
// ENTER NUMBER
// ==============================

function enterNumber(number) {

    // Start new number after result
    if (shouldResetDisplay) {

        currentValue = "0";
        shouldResetDisplay = false;

        percentageValue = null;
        percentageApplied = false;
    }

    // Prevent two decimal points
    if (
        number === "." &&
        currentValue.includes(".")
    ) {
        return;
    }

    // Decimal after zero
    if (
        currentValue === "0" &&
        number === "."
    ) {
        currentValue = "0.";
        return;
    }

    // Replace starting zero
    if (
        currentValue === "0" &&
        number !== "."
    ) {
        currentValue = number;
    }

    else {
        currentValue += number;
    }

    percentageValue = null;
    percentageApplied = false;
}


// ==============================
// CHOOSE OPERATOR
// ==============================

function chooseOperator(selectedOperator) {

    if (currentValue === "Error") {
        return;
    }

    // If there is already an operation,
    // calculate it first.
    if (
        operator !== null &&
        previousValue !== "" &&
        !shouldResetDisplay
    ) {
        calculate();
    }

    previousValue = currentValue;
    operator = selectedOperator;

    shouldResetDisplay = true;

    percentageValue = null;
    percentageApplied = false;
}


// ==============================
// PERCENTAGE
//
// Rules this implements:
//   50 %              -> 0.5
//   700 + 50 % =      -> 1050   (50% OF 700, added)
//   700 − 50 % =      -> 350    (50% OF 700, subtracted)
//   700 × 50 % =      -> 350    (50% treated as 0.5)
//   700 ÷ 50 % =      -> 1400   (50% treated as 0.5)
//
// The key fix: pressing % never rewrites currentValue into
// "the percent of the previous value" immediately. It only
// records the raw percent (e.g. 50) and a flag. The actual
// scaling relative to the first operand happens later, inside
// calculate(), once we know whether the operator is +/− (percent
// OF the first number) or ×/÷ (percent as a plain 0.5 factor).
// ==============================

function percentage() {

    if (currentValue === "Error") {
        return;
    }

    const number = parseFloat(currentValue);

    if (isNaN(number)) {
        return;
    }


    // --------------------------------
    // PERCENTAGE WITH OPERATOR
    // --------------------------------

    if (
        previousValue !== "" &&
        operator !== null
    ) {

        /*
            Example:

            700 + 50 %

            We store 50.
            We DON'T change it to 350 here.
        */

        percentageValue = number;
        percentageApplied = true;

        // Show the percentage number
        currentValue = String(number);

        return;
    }


    // --------------------------------
    // NORMAL PERCENTAGE
    // --------------------------------

    /*
        Example:

        50 %

        50 / 100 = 0.5
    */

    currentValue = formatNumber(number / 100);
}


// ==============================
// CALCULATE
// ==============================

function calculate() {

    if (
        operator === null ||
        previousValue === ""
    ) {
        return;
    }

    const firstNumber = parseFloat(previousValue);

    let secondNumber;


    // =================================
    // PERCENTAGE CALCULATION
    // =================================

    if (percentageApplied) {

        const percent = percentageValue / 100;


        // 700 + 50%
        // 50% of 700 = 350

        if (operator === "+") {

            secondNumber =
                firstNumber * percent;
        }


        // 700 - 50%
        // 50% of 700 = 350

        else if (operator === "−") {

            secondNumber =
                firstNumber * percent;
        }


        // 700 × 50%
        // 50% = 0.5

        else if (operator === "×") {

            secondNumber =
                percent;
        }


        // 700 ÷ 50%
        // 50% = 0.5

        else if (operator === "÷") {

            secondNumber =
                percent;
        }
    }

    else {

        secondNumber = parseFloat(currentValue);
    }


    // =================================
    // VALIDATION
    // =================================

    if (
        isNaN(firstNumber) ||
        isNaN(secondNumber)
    ) {

        currentValue = "Error";

        previousValue = "";
        operator = null;

        shouldResetDisplay = true;

        percentageValue = null;
        percentageApplied = false;

        return;
    }


    // =================================
    // CALCULATION
    // =================================

    let result;


    switch (operator) {

        case "+":

            result =
                firstNumber + secondNumber;

            break;


        case "−":

            result =
                firstNumber - secondNumber;

            break;


        case "×":

            result =
                firstNumber * secondNumber;

            break;


        case "÷":

            if (secondNumber === 0) {

                currentValue = "Error";

                previousValue = "";
                operator = null;

                shouldResetDisplay = true;

                percentageValue = null;
                percentageApplied = false;

                return;
            }

            result =
                firstNumber / secondNumber;

            break;
    }


    // =================================
    // ROUND RESULT
    // =================================

    result =
        Math.round(
            (result + Number.EPSILON) * 100000000
        ) / 100000000;


    // =================================
    // HISTORY
    // =================================

    let expression;

    if (percentageApplied) {

        expression =
            `${firstNumber} ${operator} ${percentageValue}%`;
    }

    else {

        expression =
            `${firstNumber} ${operator} ${currentValue}`;
    }


    addToHistory(expression, result);


    // =================================
    // UPDATE RESULT
    // =================================

    currentValue = String(result);

    previousValue = "";
    operator = null;

    shouldResetDisplay = true;

    percentageValue = null;
    percentageApplied = false;
}


// ==============================
// ALL CLEAR
// ==============================

function clearCalculator() {

    currentValue = "0";
    previousValue = "";
    operator = null;

    shouldResetDisplay = false;

    percentageValue = null;
    percentageApplied = false;
}


// ==============================
// DELETE
// ==============================

function deleteNumber() {

    if (currentValue === "Error") {

        clearCalculator();
        return;
    }

    if (shouldResetDisplay) {
        return;
    }

    if (currentValue.length <= 1) {

        currentValue = "0";
    }

    else {

        currentValue =
            currentValue.slice(0, -1);
    }

    percentageValue = null;
    percentageApplied = false;
}


// ==============================
// PLUS / MINUS
// ==============================

function toggleSign() {

    if (
        currentValue === "0" ||
        currentValue === "Error"
    ) {
        return;
    }

    currentValue =
        String(parseFloat(currentValue) * -1);
}


// ==============================
// FORMAT NUMBER
// ==============================

function formatNumber(number) {

    return String(
        Math.round(
            (number + Number.EPSILON) * 100000000
        ) / 100000000
    );
}


// ==============================================================
// SCIENTIFIC ENGINE
//
// Scientific mode works differently from Basic mode: instead of
// tracking a running "previous value / operator / current value"
// chain, it builds a full expression string (e.g. "sin(30)+2^3")
// as the person types, then evaluates it in one pass when they
// press "=". This is what makes parentheses, powers, and nested
// functions possible.
//
// The four "postfix" buttons (x², 1/x, %, +/-) don't append to
// the end of the expression — they rewrap whatever the last
// complete number/expression-group was, e.g. typing "5" then
// pressing x² turns "5" into "(5^2)".
// ==============================================================

const SCI_FUNCTIONS = ["sin", "cos", "tan", "log", "ln"];
const SCI_OPERATORS = ["+", "−", "×", "÷", "^"];


// ------------------------------
// Append a token (digit, operator, function-open, constant...)
// ------------------------------

function sciInput(token) {

    if (sciExpression === "Error") {
        sciExpression = "0";
    }

    if (sciJustEvaluated) {

        previousDisplay.textContent = "";

        // Continuing with an operator keeps the previous result
        // as the left-hand side; anything else starts fresh.
        if (!SCI_OPERATORS.includes(token)) {
            sciExpression = "0";
        }

        sciJustEvaluated = false;
    }

    if (sciExpression === "0") {
        sciExpression = token;
    } else {
        sciExpression += token;
    }
}


// ------------------------------
// Find the span of the last complete "primary" in the expression
// (a plain number, a constant, or a balanced (...) group — including
// a function name glued to its parentheses, e.g. "sin(30)").
// Returns [start, end] or null if there's nothing sensible to wrap.
// ------------------------------

function getLastPrimarySpan(expr) {

    if (!expr || expr === "0" || expr === "Error") {
        return null;
    }

    const end = expr.length;

    // Ends with a closed group: walk backward to find the matching "(".
    if (expr[end - 1] === ")") {

        let depth = 0;
        let i = end - 1;

        for (; i >= 0; i--) {

            if (expr[i] === ")") depth++;
            else if (expr[i] === "(") {
                depth--;
                if (depth === 0) break;
            }
        }

        if (i < 0) return null; // malformed, bail out safely

        let start = i;

        // Pull in a function name immediately before the "(", if any,
        // so "sin(30)" wraps as a whole rather than just "(30)".
        for (const fn of SCI_FUNCTIONS) {
            if (start - fn.length >= 0 && expr.slice(start - fn.length, start) === fn) {
                start -= fn.length;
                break;
            }
        }

        if (start > 0 && expr[start - 1] === "√") {
            start -= 1;
        }

        return [start, end];
    }

    // Trailing plain number (integer or decimal).
    const numberMatch = expr.match(/(\d+\.?\d*)$/);
    if (numberMatch) {
        return [end - numberMatch[0].length, end];
    }

    // Trailing constant.
    if (expr[end - 1] === "π" || expr[end - 1] === "e") {
        return [end - 1, end];
    }

    return null;
}

function wrapLastPrimary(wrapFn) {

    if (sciExpression === "Error") {
        return;
    }

    if (sciJustEvaluated) {
        // Operate directly on the result that's currently shown.
        sciJustEvaluated = false;
        previousDisplay.textContent = "";
    }

    const span = getLastPrimarySpan(sciExpression);

    if (!span) {
        return;
    }

    const [start, end] = span;
    const primaryText = sciExpression.slice(start, end);

    sciExpression =
        sciExpression.slice(0, start) +
        wrapFn(primaryText) +
        sciExpression.slice(end);
}


// ------------------------------
// Clear / backspace
// ------------------------------

function sciClear() {

    sciExpression = "0";
    sciJustEvaluated = false;
    previousDisplay.textContent = "";
}

function sciBackspace() {

    if (sciExpression === "Error" || sciJustEvaluated) {
        sciClear();
        return;
    }

    if (sciExpression.length <= 1) {
        sciExpression = "0";
    } else {
        sciExpression = sciExpression.slice(0, -1);
    }
}


// ------------------------------
// Tokenizer
// ------------------------------

function sciTokenize(str) {

    const tokens = [];
    let i = 0;

    while (i < str.length) {

        const ch = str[i];

        if (ch === " ") {
            i++;
            continue;
        }

        // Number literal
        if (/[0-9.]/.test(ch)) {

            let j = i;
            while (j < str.length && /[0-9.]/.test(str[j])) j++;

            const numText = str.slice(i, j);

            if ((numText.match(/\./g) || []).length > 1) {
                throw new Error("Invalid number");
            }

            tokens.push({ type: "num", value: parseFloat(numText) });
            i = j;
            continue;
        }

        if (ch === "π") {
            tokens.push({ type: "num", value: Math.PI });
            i++;
            continue;
        }

        let matchedFn = null;
        for (const fn of SCI_FUNCTIONS) {
            if (str.startsWith(fn, i)) {
                matchedFn = fn;
                break;
            }
        }
        if (matchedFn) {
            tokens.push({ type: "func", value: matchedFn });
            i += matchedFn.length;
            continue;
        }

        if (ch === "√") {
            tokens.push({ type: "func", value: "sqrt" });
            i++;
            continue;
        }

        if (ch === "e") {
            tokens.push({ type: "num", value: Math.E });
            i++;
            continue;
        }

        if ("+−×÷^".includes(ch)) {
            tokens.push({ type: "op", value: ch });
            i++;
            continue;
        }

        if (ch === "(") {
            tokens.push({ type: "lparen" });
            i++;
            continue;
        }

        if (ch === ")") {
            tokens.push({ type: "rparen" });
            i++;
            continue;
        }

        throw new Error(`Unexpected character: ${ch}`);
    }

    return tokens;
}


// ------------------------------
// Recursive-descent parser / evaluator
//
// expr  := term (('+' | '−') term)*
// term  := power (('×' | '÷') power)*
// power := unary ('^' power)?        (right-associative)
// unary := '−' unary | '+' unary | primary
// primary := number | '(' expr ')' | func '(' expr ')'
// ------------------------------

function sciEvaluate(str) {

    const tokens = sciTokenize(str);

    if (tokens.length === 0) {
        throw new Error("Empty expression");
    }

    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    function parseExpr() {

        let value = parseTerm();

        while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "−")) {
            const op = consume().value;
            const right = parseTerm();
            value = op === "+" ? value + right : value - right;
        }

        return value;
    }

    function parseTerm() {

        let value = parsePower();

        while (peek() && peek().type === "op" && (peek().value === "×" || peek().value === "÷")) {
            const op = consume().value;
            const right = parsePower();

            if (op === "÷") {
                if (right === 0) throw new Error("Division by zero");
                value = value / right;
            } else {
                value = value * right;
            }
        }

        return value;
    }

    function parsePower() {

        const base = parseUnary();

        if (peek() && peek().type === "op" && peek().value === "^") {
            consume();
            const exponent = parsePower(); // right-associative
            return Math.pow(base, exponent);
        }

        return base;
    }

    function parseUnary() {

        if (peek() && peek().type === "op" && peek().value === "−") {
            consume();
            return -parseUnary();
        }

        if (peek() && peek().type === "op" && peek().value === "+") {
            consume();
            return parseUnary();
        }

        return parsePrimary();
    }

    function parsePrimary() {

        const token = peek();

        if (!token) {
            throw new Error("Unexpected end of expression");
        }

        if (token.type === "num") {
            consume();
            return token.value;
        }

        if (token.type === "lparen") {
            consume();
            const value = parseExpr();
            if (!peek() || peek().type !== "rparen") throw new Error("Missing )");
            consume();
            return value;
        }

        if (token.type === "func") {
            consume();
            if (!peek() || peek().type !== "lparen") throw new Error("Expected ( after function");
            consume();
            const arg = parseExpr();
            if (!peek() || peek().type !== "rparen") throw new Error("Missing )");
            consume();
            return sciApplyFunction(token.value, arg);
        }

        throw new Error("Unexpected token");
    }

    const result = parseExpr();

    if (pos !== tokens.length) {
        throw new Error("Unexpected trailing input");
    }

    return result;
}

function sciApplyFunction(name, arg) {

    switch (name) {

        case "sin": return Math.sin(arg * Math.PI / 180);
        case "cos": return Math.cos(arg * Math.PI / 180);
        case "tan": return Math.tan(arg * Math.PI / 180);
        case "log": return Math.log10(arg);
        case "ln":  return Math.log(arg);

        case "sqrt":
            if (arg < 0) throw new Error("Invalid input for √");
            return Math.sqrt(arg);
    }
}

// Forgive a missing closing bracket or two, like most calculators do.
function sciAutoCloseParens(expr) {

    const opens = (expr.match(/\(/g) || []).length;
    const closes = (expr.match(/\)/g) || []).length;

    return expr + ")".repeat(Math.max(0, opens - closes));
}


// ------------------------------
// Equals
// ------------------------------

function sciEquals() {

    if (sciExpression === "Error" || sciExpression === "0") {
        return;
    }

    const exprForHistory = sciExpression;

    try {

        const raw = sciAutoCloseParens(sciExpression);
        const result = sciEvaluate(raw);

        if (!isFinite(result)) {
            throw new Error("Result out of range");
        }

        const rounded =
            Math.round((result + Number.EPSILON) * 100000000) / 100000000;

        addToHistory(exprForHistory, rounded);

        // Use the same unicode minus the tokenizer expects, so a
        // negative result can be chained straight into more input
        // (e.g. pressing "+" right after) without a parse error.
        const resultText = String(rounded).replace(/^-/, "−");

        previousDisplay.textContent = `${exprForHistory} =`;
        sciExpression = resultText;
        sciJustEvaluated = true;

    } catch (err) {

        sciExpression = "Error";
        sciJustEvaluated = true;
        previousDisplay.textContent = "";
    }
}


// ------------------------------
// Scientific display
// ------------------------------

function updateSciDisplay() {

    currentDisplay.textContent = sciExpression;

    currentDisplay.classList.remove("pulse");
    void currentDisplay.offsetWidth; // restart animation
    currentDisplay.classList.add("pulse");
}


// ==============================
// UPDATE DISPLAY
// ==============================

function updateDisplay() {

    currentDisplay.textContent =
        currentValue;

    if (
        previousValue &&
        operator
    ) {

        previousDisplay.textContent =
            `${previousValue} ${operator}`;
    }

    else {

        previousDisplay.textContent = "";
    }

    // Small glow pulse whenever the value changes
    currentDisplay.classList.remove("pulse");
    void currentDisplay.offsetWidth; // restart animation
    currentDisplay.classList.add("pulse");
}


// ==============================
// ADD TO HISTORY
// ==============================

function addToHistory(expression, result) {

    history.unshift({
        expression: expression,
        result: result
    });

    // Keep last 10 calculations
    if (history.length > 10) {
        history.pop();
    }

    displayHistory();
}


// ==============================
// DISPLAY HISTORY
// ==============================

function displayHistory() {

    historyList.innerHTML = "";

    if (history.length === 0) {

        const empty = document.createElement("p");
        empty.className = "history-empty";
        empty.textContent = "No calculations yet";
        historyList.appendChild(empty);

        return;
    }

    history.forEach(item => {

        const historyItem =
            document.createElement("div");
        historyItem.className = "history-item";

        const expr = document.createElement("span");
        expr.className = "history-expr";
        expr.textContent = item.expression;

        const result = document.createElement("span");
        result.className = "history-result";
        result.textContent = `= ${item.result}`;

        historyItem.appendChild(expr);
        historyItem.appendChild(result);

        historyList.appendChild(historyItem);

    });
}


// ==============================
// CLEAR HISTORY
// ==============================

clearHistoryButton.addEventListener(
    "click",
    () => {

        history = [];

        displayHistory();
    }
);


// ==============================
// CLICK RIPPLE EFFECT
// ==============================

function spawnRipple(button) {

    const circle = document.createElement("span");
    const size = Math.max(button.clientWidth, button.clientHeight);

    circle.className = "ripple";
    circle.style.width = circle.style.height = `${size}px`;
    circle.style.left = `${button.clientWidth / 2 - size / 2}px`;
    circle.style.top = `${button.clientHeight / 2 - size / 2}px`;

    button.appendChild(circle);

    circle.addEventListener("animationend", () => circle.remove());
}


// ==============================
// FLOATING MATH BACKGROUND
// ==============================

const MATH_SYMBOLS = [
    "+", "−", "×", "÷", "=", "%", "√", "π", "∞", "∑", "∫",
    "x", "y", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"
];

const SYMBOL_TINTS = [
    "rgba(45, 212, 240, 0.55)",
    "rgba(155, 108, 246, 0.55)",
    "rgba(246, 84, 155, 0.5)",
    "rgba(255, 180, 84, 0.45)"
];

function createMathSymbol() {

    const span = document.createElement("span");
    span.className = "math-symbol";
    span.textContent =
        MATH_SYMBOLS[Math.floor(Math.random() * MATH_SYMBOLS.length)];

    const size = 14 + Math.random() * 30;
    const duration = 16 + Math.random() * 18;
    const delay = Math.random() * -30;
    const drift = (Math.random() * 160 - 80).toFixed(0);
    const rotation = (Math.random() * 90 - 45).toFixed(0);

    span.style.setProperty("--x", `${Math.random() * 100}%`);
    span.style.setProperty("--size", `${size}px`);
    span.style.setProperty("--dur", `${duration}s`);
    span.style.setProperty("--delay", `${delay}s`);
    span.style.setProperty("--drift", `${drift}px`);
    span.style.setProperty("--rot", `${rotation}deg`);
    span.style.setProperty("--op", (0.15 + Math.random() * 0.35).toFixed(2));
    span.style.setProperty(
        "--tint",
        SYMBOL_TINTS[Math.floor(Math.random() * SYMBOL_TINTS.length)]
    );

    return span;
}

function initMathField(count) {

    if (!mathField) return;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        fragment.appendChild(createMathSymbol());
    }

    mathField.appendChild(fragment);
}

initMathField(32);


// ==============================
// KEYBOARD SUPPORT
// ==============================

document.addEventListener(
    "keydown",
    event => {

        const key = event.key;

        const operatorMap = {
            "+": "+",
            "-": "−",
            "*": "×",
            "/": "÷"
        };

        if (mode === "scientific") {

            // NUMBERS / DECIMAL
            if (!isNaN(key) || key === ".") {
                sciInput(key);
            }

            // OPERATORS (incl. ^ for power)
            else if (["+", "-", "*", "/"].includes(key)) {
                sciInput(operatorMap[key]);
            }
            else if (key === "^") {
                sciInput("^");
            }

            // PARENTHESES
            else if (key === "(" || key === ")") {
                sciInput(key);
            }

            // ENTER / EQUALS
            else if (key === "Enter" || key === "=") {
                event.preventDefault();
                sciEquals();
            }

            // BACKSPACE
            else if (key === "Backspace") {
                sciBackspace();
            }

            // ESCAPE
            else if (key === "Escape") {
                sciClear();
            }

            // PERCENTAGE
            else if (key === "%") {
                wrapLastPrimary(t => `(${t}÷100)`);
            }

        } else {

            // NUMBERS / DECIMAL
            if (!isNaN(key) || key === ".") {
                enterNumber(key);
            }

            // OPERATORS
            else if (["+", "-", "*", "/"].includes(key)) {
                chooseOperator(operatorMap[key]);
            }

            // ENTER / EQUALS
            else if (key === "Enter" || key === "=") {
                calculate();
            }

            // BACKSPACE
            else if (key === "Backspace") {
                deleteNumber();
            }

            // ESCAPE
            else if (key === "Escape") {
                clearCalculator();
            }

            // PERCENTAGE
            else if (key === "%") {
                percentage();
            }
        }

        refreshDisplay();
    }
);


// ==============================
// INITIAL DISPLAY
// ==============================

refreshDisplay();

displayHistory();
