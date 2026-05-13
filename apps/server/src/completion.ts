import { ClassDefinitions } from "./@types/data/class-defs";
import { SiiNunitClassName } from "./@types/data/sii-classes";
import type { AttributeDef, SiiClass, SiiFile } from "./@types/structure";
import { CompletionItemKind, type CompletionItem } from "vscode-languageserver/node";
import { valueSuggestions } from "./utils/attr-types";
import { snippetForTypes } from "./utils/snippet-types";

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
    // # CLASS_NAME 1
    if (cursorOffset >= documentText.indexOf(cls.className) &&
        cursorOffset <= documentText.indexOf(cls.className) + cls.className.length) {
      return [...SiiNunitClassName].sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase())).map(name => ({
        label: name,
        kind: CompletionItemKind.Class,
        documentation: {
          kind: "markdown",
          value: "Siinunit inside **class_name**"
        },
        insertTextFormat: 2,
        insertText: `${name} : \${1:unit.name} {\n\t$0\n}`,
        sortText: name.toLowerCase()
      }));
    }

    // # UNIT_NAME
    if (cursorOffset >= documentText.indexOf(cls.unitName) &&
        cursorOffset <= documentText.indexOf(cls.unitName) + cls.unitName.length) {
      return [];
    }

    // # ATTRIBUTES
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

      const existingKeys = cls.attributes.map(attr => attr.key)

      const sortedAttrs = [...def.attributes]
        .filter(attr => !existingKeys.includes(attr.key))
        .sort((a, b) => a.key.toLowerCase().localeCompare(b.key.toLowerCase()))

      return sortedAttrs.map((attr: AttributeDef) => {
          const snippet = snippetForTypes(attr.type)
          const insertText = `${attr.key}: ${snippet}`

          return {
            label: attr.key,
            kind: CompletionItemKind.Property,
            detail: Array.isArray(attr.type) ? attr.type.join(" | ") : attr.type,
            documentation: {
              kind: "markdown",
              value: `**${attr.key}** - Type: \`${Array.isArray(attr.type) ? attr.type.join(" | ") : attr.type}\`\nDescription: ${attr.description ?? ""}\n\n[See More - SCSWiki](https://modding.scssoft.com/wiki/Main_Page)`
            },
            insertTextFormat: 2,
            insertText,
            sortText: attr.key.toLowerCase()
          } as CompletionItem
        })
    }
  }

  // # CLASS_NAME inside "SiiNunit {"
  const siiStart = documentText.indexOf("SiiNunit {");
  if (siiStart !== -1 && cursorOffset > siiStart + "SiiNunit {".length) {
    return [...SiiNunitClassName].sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase())).map(name => ({
      label: name,
      kind: CompletionItemKind.Class,
      documentation: {
        kind: "markdown",
        value: "SiiNunit inside **class_name**"
      },
      insertTextFormat: 2,
      insertText: `${name} : \${1:unit.name} {\n\t$0\n}`,
      sortText: name.toLowerCase()
    }));
  }

  return [];
}


export function parseSii(documentText: string): ParsedFile {
  const classes: ParsedClass[] = []
  const regex = /(\w+)\s*:\s*(\w+)\s*{([^}]*)}/g;
  let match
  while ((match = regex.exec(documentText)) !== null) {
    const [_, className, unitName, body] = match
    const classOffset = match.index
    const bodyOffset = documentText.indexOf(body, classOffset)
    const def = ClassDefinitions[className]

    const attributes: ParsedAttribute[] = body
      .split("\n")
      .map(lineRaw => lineRaw)
      .map(line => {
        const lineStart = documentText.indexOf(line, bodyOffset)
        if ( lineStart === -1) return null

        const colonIndex = line.indexOf(":")
        if (colonIndex === -1) return null

        const afterColon = line.slice(colonIndex + 1)
        const leadingSpacesMatch = afterColon.match(/^\s*/)
        const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0

        if (leadingSpaces === 0) return null

        const keyRaw = line.slice(0, colonIndex)
        const key = keyRaw.trim()

        const value = afterColon.trim()

        const keyStart = lineStart + line.indexOf(key)
        const keyEnd = keyStart + key.length

        const valueStart = lineStart + colonIndex + 1 + leadingSpaces
        const valueEnd = lineStart + line.length

        const defAttr = def?.attributes.find(a => a.key === key)
        return {
          key,
          type: defAttr?.type ?? 'string',
          keyRange: { start: keyStart, end: keyEnd },
          valueRange: { start: valueStart, end: valueEnd }
        } as ParsedAttribute
      })
      .filter((a): a is ParsedAttribute => a !== null)

    classes.push({ className, unitName, attributes })
  }

  return { magicMark: "SiiNunit", classes }
}
