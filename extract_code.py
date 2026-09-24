import json
import os

transcript_path = r'C:\Users\hadda\.gemini\antigravity-ide\brain\147a34d7-8627-4dd3-b168-b96127427b08\.system_generated\logs\transcript_full.jsonl'
dump_dir = r'c:\Users\hadda\Downloads\NextSkill\recovery_dump2'
os.makedirs(dump_dir, exist_ok=True)

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            
            # Check for python scripts that were run via powershell
            if 'tool_calls' in step:
                for call in step['tool_calls']:
                    name = call.get('name', call.get('tool_name', ''))
                    if name == 'default_api:run_command' or name == 'run_command':
                        args = call.get('arguments', call.get('args', {}))
                        if isinstance(args, str):
                            args = json.loads(args)
                        cmd = args.get('CommandLine', '')
                        if 'with open' in cmd and 'f.write' in cmd:
                            out_name = f"{step['step_index']}_script.py"
                            with open(os.path.join(dump_dir, out_name), 'w', encoding='utf-8') as out_f:
                                out_f.write(cmd)
                            print(f"Dumped python write script at step {step['step_index']}")
        except Exception as e:
            pass
