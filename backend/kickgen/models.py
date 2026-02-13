from django.db import models
from django.contrib.auth.models import User


class GeneratedKick(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=64)
    audio_url = models.URLField()
    storage_path = models.CharField(max_length=256)
    created_at = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}, {self.name}"

    class Meta:
        ordering = ["name"]
