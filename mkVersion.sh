#!/bin/bash
VERSION=$1
echo "__version__ = '$VERSION'" > webshop/__init__.py
git add webshop/__init__.py
git commit  --amend --no-edit || exit 12
git tag -a $VERSION -m "Version $VERSION" || exit 13

git push || exit 14
git push --tags || exit 15
