import { ClassDefinitions } from "./@types/data/class-defs";
import { SiiNunitClassName } from "./@types/data/sii-classes";
import type { AttributeDef, AttributeType, SiiClass, SiiFile } from "./@types/structure";
import { CompletionItemKind, type CompletionItem } from "vscode-languageserver/node";

export function provideCompletionItems(documentText: string, cursorOffset: number): CompletionItem[] {
  const siiFile = parseSii(documentText);

  for (const cls of siiFile.classes) {
    // Cursor dentro do nome da classe → sugerir classes
    if (cursorOffset >= documentText.indexOf(cls.className) &&
        cursorOffset <= documentText.indexOf(cls.className) + cls.className.length) {
      return SiiNunitClassName.map(name => ({
        label: name,
        kind: CompletionItemKind.Class,
        documentation: "class_name"
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

      const existingKeys = cls.attributes.map(attr => attr.key);
      return def.attributes
        .filter(attr => !existingKeys.includes(attr.key))
        .map((attr: AttributeDef) => ({
          label: attr.key,
          kind: CompletionItemKind.Property,
          detail: Array.isArray(attr.type) ? attr.type.join(" | ") : attr.type,
          documentation: {
            kind: "markdown",
            value: `**${attr.key}**\n\nType: \`${Array.isArray(attr.type) ? attr.type.join(" | ") : attr.type}\`\n\nDescription: ${attr.description ?? ""}\n\n[See More](https://modding.scssoft.com/wiki/Main_Page)`
          }
        }));
    }
  }

  // Logo após "SiiNunit {" → sugerir classes
  const siiStart = documentText.indexOf("SiiNunit {");
  if (siiStart !== -1 && cursorOffset > siiStart + "SiiNunit {".length) {
    return SiiNunitClassName.map(name => ({
      label: name,
      kind: CompletionItemKind.Class,
      documentation: {
        kind: "markdown",
        value: "SiiNunt inside **class_name**"
      }
    }));
  }

  return [];
}

export function parseSii(documentText: string): SiiFile {
  const classes: SiiClass[] = [];
  const regex = /(\w+)\s*:\s*(\w+)\s*{([^}]*)}/g;
  let match;
  while ((match = regex.exec(documentText)) !== null) {
    const [_, className, unitName, body] = match;
    const attributes = body.split("\n")
      .map(line => line.trim())
      .filter(line => line.includes(":"))
      .map(line => {
        const [key] = line.split(":").map(s => s.trim());
        return { key, type: 'string' as AttributeType } satisfies AttributeDef;
      });
    classes.push({ className, unitName, attributes });
  }
  return { magicMark: "SiiNunit", classes };
}
