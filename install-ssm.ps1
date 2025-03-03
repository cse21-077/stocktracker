# Check if SSM Agent is installed
$ssmService = Get-Service -Name "AmazonSSMAgent" -ErrorAction SilentlyContinue

if ($null -eq $ssmService) {
    Write-Host "SSM Agent is not installed. Installing now..."
    
    # Download SSM Agent installer
    $url = "https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/windows_amd64/AmazonSSMAgentSetup.exe"
    $installer = "$env:TEMP\AmazonSSMAgentSetup.exe"
    
    Invoke-WebRequest -Uri $url -OutFile $installer
    
    # Install SSM Agent
    Start-Process -FilePath $installer -ArgumentList "/S" -Wait
    
    # Clean up installer
    Remove-Item $installer
    
    Write-Host "SSM Agent installed successfully"
} else {
    Write-Host "SSM Agent is already installed"
}

# Start SSM Agent service
Start-Service -Name "AmazonSSMAgent"
Set-Service -Name "AmazonSSMAgent" -StartupType Automatic

# Verify SSM Agent is running
$ssmService = Get-Service -Name "AmazonSSMAgent"
if ($ssmService.Status -eq "Running") {
    Write-Host "SSM Agent is running successfully"
} else {
    Write-Host "Failed to start SSM Agent. Please check the service status."
} 