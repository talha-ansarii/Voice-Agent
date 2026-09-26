#!/usr/bin/env bash
# Create e2-medium VM (2 vCPU / 4 GB) in asia-south1 for the voice agent.
# Requires: gcloud logged in as syllabussprint@gmail.com, billing ENABLED, project voice-agent-sprint.
set -euo pipefail

PROJECT="${GCP_PROJECT:-voice-agent-sprint}"
REGION="${GCP_REGION:-asia-south1}"
ZONE="${GCP_ZONE:-asia-south1-a}"
NAME="${GCP_VM_NAME:-voice-agent-vm}"
ACCOUNT="${GCP_ACCOUNT:-syllabussprint@gmail.com}"

gcloud config set account "$ACCOUNT"
gcloud config set project "$PROJECT"

gcloud services enable compute.googleapis.com --project="$PROJECT"

if gcloud compute instances describe "$NAME" --zone="$ZONE" --project="$PROJECT" >/dev/null 2>&1; then
  echo "VM $NAME already exists"
else
  gcloud compute instances create "$NAME" \
    --project="$PROJECT" \
    --zone="$ZONE" \
    --machine-type=e2-medium \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=30GB \
    --boot-disk-type=pd-balanced \
    --tags=voice-agent \
    --metadata=startup-script='#!/bin/bash
set -e
apt-get update
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker ubuntu
mkdir -p /opt/voice-agent
chown ubuntu:ubuntu /opt/voice-agent
'
fi

gcloud compute firewall-rules describe allow-voice-agent --project="$PROJECT" >/dev/null 2>&1 || \
  gcloud compute firewall-rules create allow-voice-agent \
    --project="$PROJECT" \
    --allow=tcp:22,tcp:80,tcp:443,tcp:3000 \
    --target-tags=voice-agent \
    --description="SSH, HTTP, HTTPS, Next.js dashboard"

echo "External IP:"
gcloud compute instances describe "$NAME" --zone="$ZONE" --project="$PROJECT" \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
