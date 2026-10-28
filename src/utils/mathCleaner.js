// src/utils/mathCleaner.js
// Thoroughly sanitizes and cleans raw LaTeX math tags, dollar signs, and unrendered symbol codes for Class 6 students.

export const cleanMathText = (str) => {
  if (!str) return '';
  return str
    // 1. Double backslash reduction (if escaped in JSON or strings)
    .replace(/\\\\/g, '\\')

    // 2. LaTeX math block wrappers: \[ ... \], \( ... \)
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')

    // 3. Fractions: \frac{a}{b} -> a/b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')

    // 4. Remove \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, \textbf{...}
    .replace(/\\(?:text|mathrm|mathbf|mathit|textbf)\s*\{([^}]+)\}/g, ' $1 ')

    // 5. Superscripts: ^{2} -> ², ^2 -> ²
    .replace(/\^\{2\}/g, '²')
    .replace(/\^2/g, '²')
    .replace(/\^\{3\}/g, '³')
    .replace(/\^3/g, '³')
    .replace(/\^\{-1\}/g, '⁻¹')
    .replace(/\^\{-2\}/g, '⁻²')
    .replace(/\^\{-3\}/g, '⁻³')
    .replace(/\^\{([0-9]+)\}/g, (_m, p1) => {
      const sups = { '0':'⁰', '1':'¹', '2':'²', '3':'³', '4':'⁴', '5':'⁵', '6':'⁶', '7':'⁷', '8':'⁸', '9':'⁹' };
      return p1.split('').map(c => sups[c] || c).join('');
    })
    .replace(/\^([0-9])/g, (_m, p1) => {
      const sups = { '0':'⁰', '1':'¹', '2':'²', '3':'³', '4':'⁴', '5':'⁵', '6':'⁶', '7':'⁷', '8':'⁸', '9':'⁹' };
      return sups[p1] || p1;
    })

    // 6. Subscripts: _{2} -> ₂
    .replace(/_\{([0-9]+)\}/g, (_m, p1) => {
      const subs = { '0':'₀', '1':'₁', '2':'₂', '3':'₃', '4':'₄', '5':'₅', '6':'₆', '7':'₇', '8':'₈', '9':'₉' };
      return p1.split('').map(c => subs[c] || c).join('');
    })
    .replace(/_([0-9])/g, (_m, p1) => {
      const subs = { '0':'₀', '1':'₁', '2':'₂', '3':'₃', '4':'₄', '5':'₅', '6':'₆', '7':'₇', '8':'₈', '9':'₉' };
      return subs[p1] || p1;
    })

    // 7. Math symbols and commands
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\^\\circ/g, '°')
    .replace(/\\degree/g, '°')
    .replace(/\\circ/g, '°')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\cdot/g, '·')
    .replace(/\\[,;:]/g, ' ')
    .replace(/\\quad/g, ' ')
    .replace(/\\qquad/g, ' ')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')

    // 8. Math dollar delimiters: $$...$$ and $...$
    .replace(/\$\$([^$]+)\$\$/g, ' $1 ')
    .replace(/\$([^$]+)\$/g, ' $1 ')
    .replace(/\$/g, '')

    // 9. Remove any remaining stray backslashed words
    .replace(/\\([a-zA-Z]+)/g, '$1')

    // 10. Clean up spacing around exponents, degrees, units, and punctuation
    .replace(/([a-zA-Z0-9])\s+([²³⁴⁵⁶⁷⁸⁹⁺⁻¹⁰])/g, '$1$2')
    .replace(/°\s+C\b/g, '°C')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:!?])/g, '$1')
    .trim();
};

export default cleanMathText;
