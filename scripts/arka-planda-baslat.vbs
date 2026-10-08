' KaizenKids'i pencere acmadan arka planda baslatir (Windows Baslangic kisayolu bunu calistirir).
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = root
shell.Run "node """ & root & "\scripts\local-server.mjs"" start", 0, False
