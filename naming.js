// ATL BIM Standards DC-GN-001 — Naming Convention Validator (browser)

const NAMING = (() => {
  const ROLE_CODES = ['AR', 'CV', 'EL', 'NV', 'GE', 'ME', 'FP', 'PL', 'ST', 'TR', 'RS', 'VT', 'GN', 'EC', 'SM', 'SU'];
  const TYPE_CODES = ['M2', 'M3', 'D1', 'S1', 'M4', 'TP', 'DC', 'RP', 'EX', 'ES', 'PR', 'SU'];
  const CONCOURSE_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'T', 'M'];
  const ANNOTATION_SUBCATS = ['DI', 'PR', 'SYM', 'TAG', 'TB'];

  const MODEL_EXTENSIONS = new Set(['rvt', 'nwc', 'nwd', 'ifc', 'dwg', 'dwfx', 'skp', 'fbx', 'dgn']);
  const FAMILY_EXTENSIONS = new Set(['rfa']);
  const ROLE_SET = new Set(ROLE_CODES);
  const TYPE_SET = new Set(TYPE_CODES);
  const CONCOURSE_SET = new Set(CONCOURSE_CODES);
  const ANNOTATION_SET = new Set(ANNOTATION_SUBCATS);

  function isValidLevel(level) {
    const u = level.toUpperCase();
    return u === 'XX' || u === 'ZZ' || /^\d{2}$/.test(level);
  }

  function isValidNumber(num) {
    return /^\d{3}$/.test(num);
  }

  function getExtension(filename) {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.substring(dot + 1).toLowerCase() : '';
  }

  function getBaseName(filename) {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.substring(0, dot) : filename;
  }

  function checkFileName(filename) {
    const issues = [];
    const ext = getExtension(filename);
    const name = getBaseName(filename);

    if (filename.includes(' ')) {
      issues.push('Contains spaces — use hyphens as separators, no spaces allowed');
    }

    const invalidChars = name.match(/[^A-Za-z0-9\-]/g);
    if (invalidChars) {
      const unique = [...new Set(invalidChars)];
      issues.push(`Contains invalid characters: ${unique.map(c => `'${c}'`).join(', ')}`);
    }

    const parts = name.split('-');
    let pattern = 'Unknown';
    let category = 'Unknown';

    // ── Revit Families (.rfa) ──────────────────────────────────────────────
    if (FAMILY_EXTENSIONS.has(ext)) {
      const isAnnotation =
        parts.length >= 3 &&
        parts[0].toUpperCase() === 'ATL' &&
        ANNOTATION_SET.has(parts[1]?.toUpperCase());

      if (isAnnotation) {
        pattern = 'ATL-SUBCAT-DESCRIPTION';
        category = 'Annotation Family';
        if (!ANNOTATION_SET.has(parts[1]?.toUpperCase())) {
          issues.push(`Unknown annotation subcategory '${parts[1]}'. Valid: ${ANNOTATION_SUBCATS.join(', ')}`);
        }
        if (parts.length < 3) {
          issues.push('Annotation family needs at least 3 parts: ATL-SUBCAT-DESCRIPTION');
        }
        parts.forEach((p, i) => {
          if (p.length > 0 && p !== p.toUpperCase()) {
            issues.push(`Part ${i + 1} ('${p}') should be UPPERCASE`);
          }
        });
      } else {
        pattern = 'CATEGORY-MANUFACTURER-DESCRIPTION';
        category = 'Revit Family';
        if (parts.length < 3) {
          issues.push(`Need at least 3 parts (found ${parts.length}): CATEGORY-MANUFACTURER-DESCRIPTION`);
        }
        parts.forEach((p, i) => {
          if (p.length > 0 && p !== p.toUpperCase()) {
            issues.push(`Part ${i + 1} ('${p}') should be UPPERCASE`);
          }
        });
      }

    // ── Model Files (.rvt, .nwc, .dwg, etc.) ──────────────────────────────
    } else if (MODEL_EXTENSIONS.has(ext) || ext === '') {
      category = 'Model File';

      if (parts.length !== 6) {
        pattern = 'SEG1-Originator-Level-Type-Role-Number';
        issues.push(
          `Expected 6 hyphen-separated parts, found ${parts.length}. ` +
          `Format: ProjectID-Originator-Level-Type-Role-Number`
        );
      } else {
        const [seg1, , level, type, role, number] = parts;

        if (CONCOURSE_SET.has(seg1.toUpperCase())) {
          if (role.toUpperCase() === 'SM') {
            pattern = 'Concourse-Originator-ZZ-M3-SM-Number';
            category = 'Site Model';
            if (level.toUpperCase() !== 'ZZ') issues.push(`Site models should use level 'ZZ' (found '${level}')`);
            if (type.toUpperCase() !== 'M3') issues.push(`Site models should use type 'M3' (found '${type}')`);
          } else {
            pattern = 'Concourse-Originator-Level-Type-Role-Number';
            category = '3D Asset Model';
          }
        } else {
          pattern = 'WBS-Originator-Level-Type-Role-Number';
          category = 'Main Model';
        }

        if (!isValidLevel(level)) {
          issues.push(`Invalid level '${level}' — use 00–99 for floors, XX for N/A, ZZ for multiple levels`);
        }
        if (!TYPE_SET.has(type.toUpperCase())) {
          issues.push(`Unknown type code '${type}'. Valid: ${TYPE_CODES.join(', ')}`);
        }
        if (!ROLE_SET.has(role.toUpperCase())) {
          issues.push(`Unknown role/discipline '${role}'. Valid: ${ROLE_CODES.join(', ')}`);
        }
        if (!isValidNumber(number)) {
          issues.push(`Number must be 3 digits like '001' (found '${number}')`);
        }
      }

    // ── Documents / Other ──────────────────────────────────────────────────
    } else {
      category = 'Document';

      if (parts.length === 6 && parts[1].toUpperCase() === 'STD') {
        pattern = 'Originator-STD-XX-Type-GN-Number';
        const [, , level, type, role, number] = parts;
        if (level.toUpperCase() !== 'XX') issues.push(`Standard documents use level 'XX' (found '${level}')`);
        if (!TYPE_SET.has(type.toUpperCase())) issues.push(`Unknown type '${type}'. Valid: ${TYPE_CODES.join(', ')}`);
        if (role.toUpperCase() !== 'GN') issues.push(`Standard documents use role 'GN' (found '${role}')`);
        if (!isValidNumber(number)) issues.push(`Number must be 3 digits like '001' (found '${number}')`);
      } else if (parts.length === 6) {
        pattern = 'SEG1-Originator-Level-Type-Role-Number';
        const [, , level, type, role, number] = parts;
        if (!isValidLevel(level)) issues.push(`Invalid level '${level}' — use 00–99, XX, or ZZ`);
        if (!TYPE_SET.has(type.toUpperCase())) issues.push(`Unknown type '${type}'. Valid: ${TYPE_CODES.join(', ')}`);
        if (!ROLE_SET.has(role.toUpperCase())) issues.push(`Unknown role '${role}'. Valid: ${ROLE_CODES.join(', ')}`);
        if (!isValidNumber(number)) issues.push(`Number must be 3 digits like '001' (found '${number}')`);
      } else {
        pattern = 'SEG1-Originator-Level-Type-Role-Number';
        issues.push(`Expected 6 hyphen-separated parts, found ${parts.length}. Format: ProjectID-Originator-Level-Type-Role-Number`);
      }
    }

    return { compliant: issues.length === 0, pattern, category, issues };
  }

  return { checkFileName, ROLE_CODES, TYPE_CODES, CONCOURSE_CODES };
})();
