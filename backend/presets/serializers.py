from rest_framework import serializers
from .models import Preset


class PresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Preset
        fields = [
            "id",
            "preset_name",
            "is_shared",
            "bpm",
            "kick_sample",
            "kick_len",
            "kick_dist_amt",
            "kick_ott_amt",
            "noise_sample",
            "noise_low_pass_freq",
            "noise_high_pass_freq",
            "noise_volume",
            "reverb_sample",
            "reverb_low_pass_freq",
            "reverb_high_pass_freq",
            "reverb_volume",
            "master_ott_amt",
            "master_dist_amt",
            "master_limiter_amt",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_preset_name(self, value):
        if not value.replace(" ", "").isalnum():
            raise serializers.ValidationError("Preset name must be alphanumeric")
        return value
