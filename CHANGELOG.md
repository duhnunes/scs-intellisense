# Change Log

All changes to the "scs-intellisense" extension will be documented in this file.

## 1.0.1 
- Add all `structures` file as a base to all system

## 1.0.0 - [2026-05-09]
- Converted project to **LSP** for improved robustness and accuracy

## 0.0.6
- Add `.sui` files support

## 0.0.5
- Fix token regex to accept lowercase letters, digits and underscore `a-z0-9_` to follow documentation
- Add automatic auto-closing for parentheses `()`
- Add syntax highlighting for numbers inside parentheses `(...)` (integers, floats and scientific notation; covers float2/3/4, placement tuples and similar)


## 0.0.4
- Add highlighting to `@include` directives
- Remove stray `prefixtype` ghost token
- Fix parsin conflict between `class` and `attribute`
  - Behavior change: a `class` is now recognized only when there is a space before the colon (`class_name :`); `name:` (no space) is treated as an attribute
- Expand `class` matching so all `class_name` forms are highlighted consistently

## 0.0.3
- Remove prefix_type ghost rule
- Add change.log

## 0.0.2
- Add multi-line comments

## 0.0.1

- Initial release