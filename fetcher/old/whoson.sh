#!/usr/bin/expect -f

set user kimada1
set host lab.cs.swarthmore.edu
set prompt "#|>|:|\\\$ ";

stty -echo
send_user -- "Password for $user@$host: "
expect_user -re "(.*)\n"
send_user "\n"
stty echo
set pass $expect_out(1,string)
log_user 0
spawn ssh kimada1@lab.cs.swarthmore.edu
log_user 1
expect "$ ";
#send "who\r"
send "nmap -sn 130.58.68.0-255\r"
#expect "latency).";
expect "$ "
set output $expect_out(buffer);
set outputs [];
puts "aaaaaa"
puts $output;
send "exit\r"
#expect "\r"
interact
