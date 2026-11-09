#!/bin/sh
# Copia el editor a docs/ (la carpeta que sirve GitHub Pages)
rm -rf docs && mkdir docs && cp -r editor/index.html editor/styles.css editor/js docs/ && touch docs/.nojekyll
echo "docs/ actualizado"
