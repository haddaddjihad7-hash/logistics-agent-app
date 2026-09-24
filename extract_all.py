import json
import os

transcript_path = r'C:\Users\hadda\.gemini\antigravity-ide\brain\147a34d7-8627-4dd3-b168-b96127427b08\.system_generated\logs\transcript_full.jsonl'
dump_dir = r'c:\Users\hadda\Downloads\NextSkill\recovery_dump'
os.makedirs(dump_dir, exist_ok=True)

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            if 'tool_calls' in step:
                for call in step['tool_calls']:
                    name = call.get('name', call.get('tool_name', ''))
                    if 'write_to_file' in name or 'replace_file_content' in name:
                        args = call.get('arguments', call.get('args', {}))
                        if isinstance(args, str):
                            args = json.loads(args)
                        
                        target_file = args.get('TargetFile')
                        if target_file:
                            content = args.get('CodeContent') or args.get('ReplacementContent')
                            if content:
                                basename = os.path.basename(target_file)
                                step_idx = step['step_index']
                                out_path = os.path.join(dump_dir, f"{step_idx}_{basename}")
                                with open(out_path, 'w', encoding='utf-8') as out_f:
                                    out_f.write(content)
                                print(f"Dumped {out_path}")
        except Exception as e:
            pass
