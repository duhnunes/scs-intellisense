import { CompletionItemKind, type CompletionItem } from "vscode-languageserver";
import type { AttributeType } from "../@types/structure";

export const valueSuggestions: Record<AttributeType, CompletionItem[]> = {
  string: [{ label: '"..."', kind: CompletionItemKind.Text }],
  float: [{ label: '0.0', kind: CompletionItemKind.Text }],
  float2: [{ label: '(0.0, 0.0)', kind: CompletionItemKind.Text }],
  float3: [{ label: '(0.0, 0.0, 0.0)', kind: CompletionItemKind.Text }],
  float4: [{ label: '(0.0, 0.0, 0.0, 0.0)', kind: CompletionItemKind.Text }],
  placement: [{ label: '(0,0,0)(1;0,0,0)', kind: CompletionItemKind.Text }],
  fixed: [{ label: '0', kind: CompletionItemKind.Text }],
  fixed2: [{ label: '(0,0)', kind: CompletionItemKind.Text }],
  fixed3: [{ label: '(0,0,0)', kind: CompletionItemKind.Text }],
  fixed4: [{ label: '(0,0,0,0)', kind: CompletionItemKind.Text }],
  int2: [{ label: '(0,0)', kind: CompletionItemKind.Text }],
  quaternion: [{ label: '(1.0, 0.0, 0.0, 0.0)', kind: CompletionItemKind.Text }],
  s16: [{ label: '-15', kind: CompletionItemKind.Text }],
  s32: [{ label: '-15', kind: CompletionItemKind.Text }],
  s64: [{ label: '-15', kind: CompletionItemKind.Text }],
  u16: [{ label: '15', kind: CompletionItemKind.Text }],
  u32: [{ label: '15', kind: CompletionItemKind.Text }],
  u64: [{ label: '15', kind: CompletionItemKind.Text }],
  bool: [
    { label: 'true', kind: CompletionItemKind.Text },
    { label: 'false', kind: CompletionItemKind.Text }
  ],
  token: [{ label: 'my_token', kind: CompletionItemKind.Text }],
  owner_ptr: [{ label: '.unit_name', kind: CompletionItemKind.Text }],
  link_ptr: [{ label: 'some.named.unit', kind: CompletionItemKind.Text }],
  resource_tie: [{ label: '"/path/to/resourche.pma"', kind: CompletionItemKind.Text }]
}
