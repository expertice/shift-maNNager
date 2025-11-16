import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const snapshotFile = 'c:\\Users\\Felix\\Downloads\\roster-snapshot-351bc1fc-6760-4609-9eed-e8ecf6259e7c-2025-11-16-22-08-05.json';
const currentFile = 'c:\\Users\\Felix\\Downloads\\roster-shifts-current-351bc1fc-6760-4609-9eed-e8ecf6259e7c-2025-11-16-22-08-05.json';

function loadAndParseJson(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading or parsing file ${filePath}:`, error);
    return null;
  }
}

function compareArrays(arr1, arr2, name, keyFn) {
  const map1 = new Map();
  arr1.forEach(item => map1.set(keyFn(item), item));
  
  const map2 = new Map();
  arr2.forEach(item => map2.set(keyFn(item), item));
  
  const onlyIn1 = [...map1.keys()].filter(key => !map2.has(key));
  const onlyIn2 = [...map2.keys()].filter(key => !map1.has(key));
  const inBoth = [...map1.keys()].filter(key => map2.has(key));
  
  return { onlyIn1, onlyIn2, inBoth, map1, map2 };
}

function compareShifts(shifts1, shifts2) {
  const keyFn = (s) => `${s.employeeId}-${s.date}-${s.shiftTypeId}`;
  return compareArrays(shifts1 || [], shifts2 || [], 'shifts', keyFn);
}

function compareEmployees(emp1, emp2) {
  const keyFn = (e) => e.id;
  return compareArrays(emp1 || [], emp2 || [], 'employees', keyFn);
}

function compareInstances(inst1, inst2) {
  const keyFn = (i) => i.id;
  return compareArrays(inst1 || [], inst2 || [], 'instances', keyFn);
}

function compareShiftTypes(st1, st2) {
  const keyFn = (st) => st.id;
  return compareArrays(st1 || [], st2 || [], 'shiftTypes', keyFn);
}

async function main() {
  const snapshot = loadAndParseJson(snapshotFile);
  const current = loadAndParseJson(currentFile);
  
  if (!snapshot || !current) {
    console.error('Failed to load one or both files');
    return;
  }
  
  console.log('=== СРАВНЕНИЕ ФАЙЛОВ ===\n');
  
  // Общая информация
  console.log('📊 ОБЩАЯ ИНФОРМАЦИЯ:');
  console.log(`Snapshot: ${snapshot.employees?.length || 0} сотрудников, ${snapshot.shifts?.length || 0} смен, ${snapshot.instances?.length || 0} instances`);
  console.log(`Current: ${current.employees?.length || 0} сотрудников, ${current.shifts?.length || 0} смен, ${current.instances?.length || 0} instances`);
  console.log(`Snapshot exportedAt: ${snapshot.exportedAt}`);
  console.log(`Current exportedAt: ${current.exportedAt}`);
  console.log(`Snapshot note: ${snapshot.note}`);
  console.log(`Current note: ${current.note}`);
  console.log('');
  
  // Смены
  console.log('🔄 СМЕНЫ:');
  const shiftsComparison = compareShifts(snapshot.shifts, current.shifts);
  console.log(`  Snapshot: ${snapshot.shifts?.length || 0} смен`);
  console.log(`  Current: ${current.shifts?.length || 0} смен`);
  if (shiftsComparison.onlyIn1.length > 0) {
    console.log(`  ⚠️  Только в snapshot: ${shiftsComparison.onlyIn1.length}`);
  }
  if (shiftsComparison.onlyIn2.length > 0) {
    console.log(`  ⚠️  Только в current: ${shiftsComparison.onlyIn2.length}`);
  }
  if (shiftsComparison.inBoth.length === 0 && (snapshot.shifts?.length || 0) === 0 && (current.shifts?.length || 0) === 0) {
    console.log(`  ❌ ОБА ФАЙЛА ПУСТЫЕ - СМЕНЫ НЕ ЗАГРУЖЕНЫ!`);
  }
  console.log('');
  
  // Сотрудники
  console.log('👥 СОТРУДНИКИ:');
  const empComparison = compareEmployees(snapshot.employees, current.employees);
  console.log(`  Snapshot: ${snapshot.employees?.length || 0} сотрудников`);
  console.log(`  Current: ${current.employees?.length || 0} сотрудников`);
  console.log(`  Общих: ${empComparison.inBoth.length}`);
  if (empComparison.onlyIn1.length > 0) {
    console.log(`  ⚠️  Только в snapshot: ${empComparison.onlyIn1.length}`);
    empComparison.onlyIn1.forEach(id => {
      const emp = empComparison.map1.get(id);
      console.log(`    - ${emp.fullName} (${emp.id})`);
    });
  }
  if (empComparison.onlyIn2.length > 0) {
    console.log(`  ⚠️  Только в current: ${empComparison.onlyIn2.length}`);
    empComparison.onlyIn2.forEach(id => {
      const emp = empComparison.map2.get(id);
      console.log(`    - ${emp.fullName} (${emp.id})`);
    });
  }
  
  // Различия в структуре сотрудников
  if (empComparison.inBoth.length > 0) {
    const firstEmp = empComparison.inBoth[0];
    const emp1 = empComparison.map1.get(firstEmp);
    const emp2 = empComparison.map2.get(firstEmp);
    
    const keys1 = new Set(Object.keys(emp1));
    const keys2 = new Set(Object.keys(emp2));
    const onlyIn1 = [...keys1].filter(k => !keys2.has(k));
    const onlyIn2 = [...keys2].filter(k => !keys1.has(k));
    
    if (onlyIn1.length > 0 || onlyIn2.length > 0) {
      console.log(`  📋 Различия в структуре (на примере первого сотрудника):`);
      if (onlyIn1.length > 0) {
        console.log(`    Только в snapshot: ${onlyIn1.join(', ')}`);
      }
      if (onlyIn2.length > 0) {
        console.log(`    Только в current: ${onlyIn2.join(', ')}`);
      }
    }
  }
  console.log('');
  
  // Instances
  console.log('🔧 INSTANCES:');
  const instComparison = compareInstances(snapshot.instances, current.instances);
  console.log(`  Snapshot: ${snapshot.instances?.length || 0} instances`);
  console.log(`  Current: ${current.instances?.length || 0} instances`);
  console.log(`  Общих: ${instComparison.inBoth.length}`);
  if (instComparison.onlyIn1.length > 0) {
    console.log(`  ⚠️  Только в snapshot: ${instComparison.onlyIn1.length}`);
  }
  if (instComparison.onlyIn2.length > 0) {
    console.log(`  ⚠️  Только в current: ${instComparison.onlyIn2.length}`);
  }
  
  // Различия в структуре instances
  if (instComparison.inBoth.length > 0) {
    const firstInst = instComparison.inBoth[0];
    const inst1 = instComparison.map1.get(firstInst);
    const inst2 = instComparison.map2.get(firstInst);
    
    const keys1 = new Set(Object.keys(inst1));
    const keys2 = new Set(Object.keys(inst2));
    const onlyIn1 = [...keys1].filter(k => !keys2.has(k));
    const onlyIn2 = [...keys2].filter(k => !keys1.has(k));
    
    if (onlyIn1.length > 0 || onlyIn2.length > 0) {
      console.log(`  📋 Различия в структуре instances:`);
      if (onlyIn1.length > 0) {
        console.log(`    Только в snapshot: ${onlyIn1.join(', ')}`);
      }
      if (onlyIn2.length > 0) {
        console.log(`    Только в current: ${onlyIn2.join(', ')}`);
      }
    }
  }
  console.log('');
  
  // ShiftTypes
  console.log('⏰ SHIFT TYPES:');
  const stComparison = compareShiftTypes(snapshot.shiftTypes, current.shiftTypes);
  console.log(`  Snapshot: ${snapshot.shiftTypes?.length || 0} типов смен`);
  console.log(`  Current: ${current.shiftTypes?.length || 0} типов смен`);
  console.log(`  Общих: ${stComparison.inBoth.length}`);
  
  // Различия в структуре shiftTypes
  if (stComparison.inBoth.length > 0) {
    const firstST = stComparison.inBoth[0];
    const st1 = stComparison.map1.get(firstST);
    const st2 = stComparison.map2.get(firstST);
    
    // Проверяем workingHours
    if (typeof st1.workingHours !== typeof st2.workingHours) {
      console.log(`  ⚠️  Различие: workingHours в snapshot - ${typeof st1.workingHours}, в current - ${typeof st2.workingHours}`);
      console.log(`    Snapshot: ${st1.workingHours}, Current: ${st2.workingHours}`);
    }
  }
  console.log('');
  
  // EmployeeOrder
  console.log('📋 EMPLOYEE ORDER:');
  const order1 = snapshot.employeeOrder || [];
  const order2 = current.employeeOrder || [];
  console.log(`  Snapshot: ${order1.length} сотрудников в порядке`);
  console.log(`  Current: ${order2.length} сотрудников в порядке`);
  
  if (order1.length === order2.length) {
    const isSame = order1.every((id, idx) => id === order2[idx]);
    if (isSame) {
      console.log(`  ✅ Порядок совпадает`);
    } else {
      console.log(`  ⚠️  Порядок РАЗЛИЧАЕТСЯ`);
      const firstDiff = order1.findIndex((id, idx) => id !== order2[idx]);
      if (firstDiff >= 0) {
        console.log(`    Первое различие на позиции ${firstDiff}:`);
        console.log(`      Snapshot: ${order1[firstDiff]}`);
        console.log(`      Current: ${order2[firstDiff]}`);
      }
    }
  } else {
    console.log(`  ⚠️  Разная длина порядков`);
  }
  console.log('');
  
  // ИТОГОВЫЙ ВЫВОД
  console.log('=== ИТОГОВЫЙ ВЫВОД ===');
  const issues = [];
  
  if ((snapshot.shifts?.length || 0) === 0 && (current.shifts?.length || 0) === 0) {
    issues.push('❌ КРИТИЧНО: Оба файла содержат пустой массив shifts - смены не загружены!');
  }
  
  if (empComparison.onlyIn1.length > 0 || empComparison.onlyIn2.length > 0) {
    issues.push(`⚠️  Разное количество сотрудников: snapshot=${snapshot.employees?.length || 0}, current=${current.employees?.length || 0}`);
  }
  
  if (instComparison.onlyIn1.length > 0 || instComparison.onlyIn2.length > 0) {
    issues.push(`⚠️  Разное количество instances: snapshot=${snapshot.instances?.length || 0}, current=${current.instances?.length || 0}`);
  }
  
  if (issues.length === 0) {
    console.log('✅ Все основные данные совпадают (кроме структуры объектов)');
  } else {
    issues.forEach(issue => console.log(issue));
  }
}

main().catch(console.error);

