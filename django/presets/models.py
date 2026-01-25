from enum import unique
from django.db import models
from django.contrib.auth.models import User


class Preset(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    preset_name = models.CharField(max_length=32)

    bpm = models.PositiveSmallIntegerField()

    kick_sample = models.CharField(max_length=32)
    kick_len = models.FloatField()
    kick_dist_amt = models.FloatField()
    kick_ott_amt = models.FloatField()

    noise_sample = models.CharField(max_length=32)
    noise_low_pass_freq = models.FloatField()
    noise_high_pass_freq = models.FloatField()
    noise_volume = models.FloatField()

    reverb_sample = models.CharField(max_length=32)
    reverb_low_pass_freq = models.FloatField()
    reverb_high_pass_freq = models.FloatField()
    reverb_volume = models.FloatField()

    master_ott_amt = models.FloatField()
    master_dist_amt = models.FloatField()
    master_limiter_amt = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}, {self.preset_name}"

    class Meta:
        unique_together = ["user", "preset_name"]
        ordering = ["preset_name"]


class SharedPreset(models.Model):
    preset_name = models.CharField(max_length=32, unique=True)

    bpm = models.PositiveSmallIntegerField()

    kick_sample = models.CharField(max_length=32)
    kick_len = models.FloatField()
    kick_dist_amt = models.FloatField()
    kick_ott_amt = models.FloatField()

    noise_sample = models.CharField(max_length=32)
    noise_low_pass_freq = models.FloatField()
    noise_high_pass_freq = models.FloatField()
    noise_volume = models.FloatField()

    reverb_sample = models.CharField(max_length=32)
    reverb_low_pass_freq = models.FloatField()
    reverb_high_pass_freq = models.FloatField()
    reverb_volume = models.FloatField()

    master_ott_amt = models.FloatField()
    master_dist_amt = models.FloatField()
    master_limiter_amt = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.preset_name

    class Meta:
        ordering = ["preset_name"]
