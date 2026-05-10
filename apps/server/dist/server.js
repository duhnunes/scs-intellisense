"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var node_1 = require("vscode-languageserver/node");
var vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
var connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
var documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
connection.onInitialize(function (params) {
    return {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental
        }
    };
});
documents.onDidChangeContent(function (change) {
    connection.console.log("File changed: ".concat(change.document.uri));
});
documents.listen(connection);
connection.listen();
