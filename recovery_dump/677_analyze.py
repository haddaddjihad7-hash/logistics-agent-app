import json
import os

transcript_path = r'C:\Users\hadda\.gemini\antigravity-ide\brain\147a34d7-8627-4dd3-b168-b96127427b08\.system_generated\logs\transcript_full.jsonl'

output_files = {}

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            if 'tool_calls' in step:
                for call in step['tool_calls']:
                    # Check write_to_file
                    if call.get('name') == 'default_api:write_to_file' or call.get('tool_name') == 'default_api:write_to_file':
                        args = call.get('arguments', call.get('args', {}))
                        if isinstance(args, str):
                            args = json.loads(args)
                        
                        target_file = args.get('TargetFile')
                        content = args.get('CodeContent')
                        
                        if target_file and content:
                            if target_file not in output_files:
                                output_files[target_file] = []
                            output_files[target_file].append((step['step_index'], 'write_to_file'))

                    # Check run_command
                    if call.get('name') == 'default_api:run_command' or call.get('tool_name') == 'default_api:run_command':
                        args = call.get('arguments', call.get('args', {}))
                        if isinstance(args, str):
                            args = json.loads(args)
                        
                        cmd = args.get('CommandLine', '')
                        if 'with open(' in cmd and '.write(' in cmd:
                            print(f"Found run_command file write at step {step['step_index']}")
                        elif 'New-Item' in cmd or 'Out-File' in cmd or 'Set-Content' in cmd:
                            print(f"Found powershell file write at step {step['step_index']}")
        except Exception as e:
            pass

for target, history in output_files.items():
    print(f"{target}: {history}")
