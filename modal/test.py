import modal

cls = modal.Cls.from_name("kick-generator-app", "KickGenerator")
generator = cls()
wav_bytes = generator.generate_kick.remote("hit house")
print(f"Got {len(wav_bytes)} bytes")
with open("/tmp/test_kick.wav", "wb") as f:
    f.write(wav_bytes)
print("Saved to /tmp/test_kick.wav")
