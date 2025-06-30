#!/bin/bash

# Helper script to create test WAV files for the voice bot

if [ $# -eq 0 ]; then
    echo "❌ Please provide text to convert to speech"
    echo ""
    echo "Usage: ./scripts/create-test-audio.sh \"Your text here\" [filename]"
    echo ""
    echo "Examples:"
    echo "  ./scripts/create-test-audio.sh \"Hello world\""
    echo "  ./scripts/create-test-audio.sh \"How are you?\" my-test"
    echo ""
    exit 1
fi

TEXT="$1"
FILENAME="${2:-custom-test}"
OUTPUT_FILE="audio/${FILENAME}.wav"

echo "🎤 Creating audio file..."
echo "📝 Text: $TEXT"
echo "📁 Output: $OUTPUT_FILE"
echo ""

# Create WAV file using macOS say command
say -o "$OUTPUT_FILE" -f wav --data-format=LEI16@48000 "$TEXT"

if [ $? -eq 0 ]; then
    echo "✅ Audio file created successfully!"
    echo ""
    echo "🚀 Test it with:"
    echo "   pnpm test-file $OUTPUT_FILE"
    echo ""
    
    # Show file info
    FILE_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE")
    echo "📊 File size: $FILE_SIZE bytes"
else
    echo "❌ Failed to create audio file"
    exit 1
fi 