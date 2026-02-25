#!/usr/bin/env python3
"""
Sakura AI - Google genai Interactions API
This script uses the new Google genai library with client.interactions.create()
"""

import os
import sys
import json

def main():
    # Get API key from environment variable or use default
    api_key = os.environ.get('GOOGLE_API_KEY', 'AIzaSyAb8vLr9c-UPUxLKUJTb2c_TJNFpU9Frdw')
    
    if not api_key:
        print(json.dumps({"error": "GOOGLE_API_KEY not configured"}))
        sys.exit(1)
    
    try:

        from google import genai
        
        client = genai.Client(api_key=api_key)
        
        # Get input from command line argument
        input_text = sys.argv[1] if len(sys.argv) > 1 else "Hello"
        model = sys.argv[2] if len(sys.argv) > 2 else "gemini-2.0-flash"
        
        interaction = client.interactions.create(
            model=model,
            input=input_text
        )
        
        # Get the last output text
        if interaction.outputs and len(interaction.outputs) > 0:
            result_text = interaction.outputs[-1].text
        else:
            result_text = "No response generated"
        
        print(json.dumps({
            "success": True,
            "text": result_text,
            "model": model
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
