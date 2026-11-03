@echo off
echo Starting Apache JMeter with LabTrack Test Plan...
start "" "%~dp0tools\apache-jmeter-5.6.3\bin\jmeter.bat" -t "%~dp0tests\jmeter\LabTrack_Performance_Test.jmx"

