#!/bin/bash

FILE="src/components/AccountsPage.tsx"

# Main containers
sed -i '' 's/bg-white rounded-xl shadow-sm border border-gray-200/bg-zinc-900\/60 dark:bg-zinc-900\/60 rounded-xl shadow-sm border border-white\/10/g' "$FILE"

# Headers
sed -i '' 's/text-2xl font-bold text-gray-900/text-2xl font-bold text-gray-900 dark:text-white/g' "$FILE"
sed -i '' 's/text-xl font-bold text-gray-900/text-xl font-bold text-gray-900 dark:text-white/g' "$FILE"
sed -i '' 's/text-xl font-semibold text-gray-900/text-xl font-semibold text-gray-900 dark:text-white/g' "$FILE"
sed -i '' 's/text-lg font-medium text-gray-900/text-lg font-medium text-gray-900 dark:text-white/g' "$FILE"
sed -i '' 's/text-sm font-medium text-gray-900/text-sm font-medium text-gray-900 dark:text-white/g' "$FILE"

# Table cells
sed -i '' 's/text-sm text-gray-900 capitalize/text-sm text-gray-900 dark:text-white capitalize/g' "$FILE"
sed -i '' 's/whitespace-nowrap text-sm text-gray-900/whitespace-nowrap text-sm text-gray-900 dark:text-white/g' "$FILE"
sed -i '' 's/whitespace-nowrap text-sm font-medium text-gray-900/whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white/g' "$FILE"
sed -i '' 's/text-3xl font-bold text-gray-900/text-3xl font-bold text-gray-900 dark:text-white/g' "$FILE"

# Chart cards
sed -i '' 's/bg-white border border-gray-100 rounded-2xl/bg-zinc-900\/60 dark:bg-zinc-900\/60 border border-white\/10 rounded-2xl/g' "$FILE"
sed -i '' 's/bg-blue-50 rounded-xl/bg-blue-500\/10 dark:bg-blue-500\/10 rounded-xl/g' "$FILE"
sed -i '' 's/bg-green-50 rounded-xl/bg-green-500\/10 dark:bg-green-500\/10 rounded-xl/g' "$FILE"
sed -i '' 's/bg-purple-50 rounded-xl/bg-purple-500\/10 dark:bg-purple-500\/10 rounded-xl/g' "$FILE"

# Hover states
sed -i '' "s/'hover:bg-gray-50 transition-colors cursor-pointer'/'hover:bg-white\/5 dark:hover:bg-white\/5 transition-colors cursor-pointer'/g" "$FILE"
sed -i '' "s/'bg-blue-50': selectedAccount/'bg-blue-900\/20 dark:bg-blue-900\/20': selectedAccount/g" "$FILE"

# Buttons in time period selector
sed -i '' "s/border-blue-500 bg-blue-50 text-blue-700/border-blue-500 bg-blue-600 text-white/g" "$FILE"
sed -i '' "s/border-gray-200 text-gray-600 hover:bg-gray-50/border-gray-700 dark:border-gray-700 text-gray-400 dark:text-gray-400 hover:bg-gray-800 dark:hover:bg-gray-800/g" "$FILE"

# Modal
sed -i '' 's/bg-white rounded-2xl p-8/bg-zinc-900 dark:bg-zinc-900 rounded-2xl p-8/g' "$FILE"
sed -i '' 's/text-sm font-semibold text-gray-900/text-sm font-semibold text-gray-900 dark:text-white/g' "$FILE"
sed -i '' "s/border-gray-200 hover:border-gray-300 hover:bg-gray-50/border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800/g" "$FILE"

echo "✅ Dark theme fixes applied!"
