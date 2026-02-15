const fs = require('fs');
const path = require('path');

const rbsPath = path.join(__dirname, '../public/rbs/ruby-stdlib.rbs');
const indexPath = path.join(__dirname, '../public/data/rurima_index.json');

function parseRbs(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const relationships = {}; // child -> parent
  const includes = {}; // child -> [modules]
  const methods = {}; // methodName -> [Class#method, ...]

  const contextStack = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // クラス定義: class Name < Parent
    const classMatch = line.match(/^class\s+([\w:]+)(?:\[[^\]]+\])?(?:\s*<\s*([\w:]+)(?:\[[^\]]+\])?)?/);
    if (classMatch) {
      contextStack.push(classMatch[1]);
      const currentContext = contextStack.join('::').replace(/^::/, '');
      let className = classMatch[1];
      if (contextStack.length > 1 && !className.startsWith('::')) {
          className = currentContext;
      }
      className = className.replace(/^::/, '');

      const parentName = classMatch[2] || 'Object';
      relationships[className] = parentName;
      continue;
    }

    // モジュール定義: module Name (: Parent)
    const moduleMatch = line.match(/^module\s+([\w:]+)(?:\[[^\]]+\])?(?:\s*:\s*([\w:]+)(?:\[[^\]]+\])?)?/);
    if (moduleMatch) {
      contextStack.push(moduleMatch[1]);
      const moduleName = contextStack.join('::').replace(/^::/, '');

      if (moduleMatch[2]) {
          const parentName = moduleMatch[2];
          relationships[moduleName] = parentName;
          if (!includes[moduleName]) includes[moduleName] = [];
          if (!includes[moduleName].includes(parentName)) {
            includes[moduleName].push(parentName);
          }
      }
      continue;
    }

    // インターフェース定義: interface Name
    const interfaceMatch = line.match(/^interface\s+([\w:]+)(?:\[[^\]]+\])?/);
    if (interfaceMatch) {
      contextStack.push(interfaceMatch[1]);
      continue;
    }

    // インクルード: include Module
    const includeMatch = line.match(/^include\s+([\w:]+)(?:\[[^\]]+\])?/);
    if (includeMatch && contextStack.length > 0) {
      const currentContext = contextStack.join('::').replace(/^::/, '');
      if (!includes[currentContext]) includes[currentContext] = [];
      if (!includes[currentContext].includes(includeMatch[1])) {
        includes[currentContext].push(includeMatch[1]);
      }
      continue;
    }

    // メソッド定義: def name
    const methodMatch = line.match(/^def\s+(?:self\.|self\?\.)?([\w=!=\?\+-\/\*<>\[\]]+)/);
    if (methodMatch && contextStack.length > 0) {
      const methodName = methodMatch[1];
      const currentContext = contextStack.join('::').replace(/^::/, '');
      
      const signatures = [];
      if (line.includes('def self?.')) {
        signatures.push(`${currentContext}#${methodName}`);
        signatures.push(`${currentContext}.${methodName}`);
      } else {
        const isSelf = line.includes('def self.');
        signatures.push(`${currentContext}${isSelf ? '.' : '#'}${methodName}`);
      }

      if (!methods[methodName]) methods[methodName] = [];
      for (const signature of signatures) {
        if (!methods[methodName].includes(signature)) {
          methods[methodName].push(signature);
        }
      }
    }
    
    // 定義の終了
    if (line === 'end') {
        contextStack.pop();
    }
  }

  return { relationships, includes, methods };
}

function buildAncestorChain(className, relationships, includes) {
  const chain = [className];
  const visited = new Set();
  visited.add(className);

  let current = className;

  while (current) {
    // インクルードされたモジュールを追加
    if (includes[current]) {
      for (const mod of includes[current]) {
        if (!visited.has(mod)) {
          chain.push(mod);
          visited.add(mod);
        }
      }
    }

    // 親クラスへ
    const parent = relationships[current];
    if (parent && !visited.has(parent)) {
      chain.push(parent);
      visited.add(parent);
      current = parent;
    } else {
      // 親がいなくて、ObjectでなければObjectを追加
      if (current !== 'BasicObject' && current !== 'Object' && !visited.has('Object')) {
          chain.push('Object');
          visited.add('Object');
          current = 'Object';
      } else if (current === 'Object' && !visited.has('Kernel')) {
          chain.push('Kernel');
          visited.add('Kernel');
          current = 'Object';
      } else if (current === 'Object' && visited.has('Kernel') && !visited.has('BasicObject')) {
          chain.push('BasicObject');
          visited.add('BasicObject');
          current = null;
      } else {
          current = null;
      }
    }
  }

  return chain;
}

const { relationships, includes, methods } = parseRbs(rbsPath);

// 継承マップ生成
const allClasses = new Set([...Object.keys(relationships), ...Object.keys(includes)]);
const inheritanceMap = {};
for (const className of allClasses) {
  inheritanceMap[className] = buildAncestorChain(className, relationships, includes);
}

// 両方出力できるように分割するが、取り急ぎJSONとして出力
fs.writeFileSync(indexPath.replace('rurima_index.json', 'inheritance_map.json'), JSON.stringify(inheritanceMap, null, 2));
fs.writeFileSync(indexPath, JSON.stringify(methods, null, 2));

console.log('Extraction complete. Files generated: inheritance_map.json, rurima_index.json');
