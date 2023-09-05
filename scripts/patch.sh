#!/bin/zsh

path_prefix=/tmp/xfs-$RANDOM
path_source=$path_prefix/source
path_user=$path_prefix/user
dep=$1

pnpm patch --edit-dir $path_user $dep
cp -rL node_modules/$dep $path_source

read -s -k '?Press any key to continue.'

pnpm patch-commit $path_user
rm -rf $path_prefix
