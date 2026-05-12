import { ClassDefinitions } from "./@types/data/class-defs";
import { SiiNunitClassName } from "./@types/data/sii-classes";
import type { AttributeDef, SiiClass, SiiFile } from "./@types/structure";
import { CompletionItemKind, type CompletionItem } from "vscode-languageserver/node";
import { valueSuggestions } from "./utils/attr-types";

interface ParsedAttribute extends AttributeDef {
  keyRange: { start: number; end: number }
  valueRange: { start: number; end: number }
}
interface ParsedClass extends SiiClass {
  attributes: ParsedAttribute[]
}
interface ParsedFile extends SiiFile {
  classes: ParsedClass[]
}

export function provideCompletionItems(documentText: string, cursorOffset: number): CompletionItem[] {
  const siiFile = parseSii(documentText);

  for (const cls of siiFile.classes) {
    // Cursor dentro do nome da classe → sugerir classes
    if (cursorOffset >= documentText.indexOf(cls.className) &&
        cursorOffset <= documentText.indexOf(cls.className) + cls.className.length) {
      return SiiNunitClassName.map(name => ({
        label: name,
        kind: CompletionItemKind.Class,
        documentation: {
          kind: "markdown",
          value: "Siinunit inside **class_name**"
        },
        insertText: `${name} : `
      }));
    }

    // Cursor dentro do unitName → nada
    if (cursorOffset >= documentText.indexOf(cls.unitName) &&
        cursorOffset <= documentText.indexOf(cls.unitName) + cls.unitName.length) {
      return [];
    }

    // Cursor dentro do corpo da classe → atributos
    const classStart = documentText.indexOf("{", documentText.indexOf(cls.unitName));
    const classEnd = documentText.indexOf("}", classStart);
    if (cursorOffset > classStart && cursorOffset < classEnd) {
      const def = ClassDefinitions[cls.className];
      if (!def) return [];

      for (const attr of cls.attributes) {
        if (cursorOffset >= attr.valueRange.start && cursorOffset <= attr.valueRange.end) {
          const type = Array.isArray(attr.type) ? attr.type[0] : attr.type
          return valueSuggestions[type] ?? [{ label: '<value>', kind: CompletionItemKind.Text }]
        }
      }

      const existingKeys = cls.attributes.map(attr => attr.key);
      return def.attributes
        .filter(attr => !existingKeys.includes(attr.key))
        .map((attr: AttributeDef) => ({
          label: attr.key,
          kind: CompletionItemKind.Property,
          detail: Array.isArray(attr.type) ? attr.type.join(" | ") : attr.type,
          documentation: {
            kind: "markdown",
            value: `**${attr.key}** - Type: \`${Array.isArray(attr.type) ? attr.type.join(" | ") : attr.type}\`\nDescription: ${attr.description ?? ""}\n\n[See More - SCSWiki](https://modding.scssoft.com/wiki/Main_Page)`
          },
          insertText: `${attr.key}: `
        }));
    }
  }

  // After "SiiNunit {" → suggest classes
  const siiStart = documentText.indexOf("SiiNunit {");
  if (siiStart !== -1 && cursorOffset > siiStart + "SiiNunit {".length) {
    return SiiNunitClassName.map(name => ({
      label: name,
      kind: CompletionItemKind.Class,
      documentation: {
        kind: "markdown",
        value: "SiiNunit inside **class_name**"
      },
      insertText: `${name} : `
    }));
  }

  return [];
}


export function parseSii(documentText: string): ParsedFile {
  const classes: ParsedClass[] = [];
  const regex = /(\w+)\s*:\s*(\w+)\s*{([^}]*)}/g;
  let match;
  while ((match = regex.exec(documentText)) !== null) {
    const [_, className, unitName, body] = match;
    const classOffset = match.index
    const bodyOffset = documentText.indexOf(body, classOffset)
    const def = ClassDefinitions[className]
    const attributes: ParsedAttribute[] = body.split("\n")
      .map(line => line.trim())
      .filter(line => line.includes(":"))
      .map(line => {
        const lineStart = documentText.indexOf(line, bodyOffset)
        const [key, value] = line.split(":").map(s => s.trim())
        const keyStart = lineStart
        const keyEnd = keyStart + key.length
        const colonIndex = line.indexOf(":")
        const valueStart = lineStart + colonIndex + 1
        const valueEnd = valueStart + value.length

        const defAttr = def?.attributes.find(a => a.key === key)
        return {
          key,
          type: defAttr?.type ?? 'string',
          keyRange: { start: keyStart, end: keyEnd },
          valueRange: { start: valueStart, end: valueEnd }
        };
      });
    classes.push({ className, unitName, attributes });
  }
  return { magicMark: "SiiNunit", classes };
}
