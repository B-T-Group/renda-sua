import json, sys
copy = json.load(open('tools/i18n/mm-delivered-copy.json'))
STATUS = {'en': 'Delivered', 'fr': 'Livrée'}
def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict):
            dst.setdefault(k, {})
            merge(dst[k], v)
        else:
            dst[k] = v
for base in sys.argv[1:]:
    for lang in ('en', 'fr'):
        p = f'{base}/{lang}.json'
        d = json.load(open(p))
        merge(d, copy[lang])
        d['common']['orderStatus']['awaiting_client_confirmation'] = STATUS[lang]
        with open(p, 'w') as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write('\n')
