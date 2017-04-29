"""
Kei Imada
20170425
Checks who's on on the lab.cs.swarthmore.edu network
"""
import getpass
import subprocess
import sys
import socket

MAINHOST = "lab.cs.swarthmore.edu"
HOSTLOC = "/usr/swat/db"
USER = raw_input("username: ")  # "kimada1"
PASSWORD =""
try:
    import paramiko
    SSH = paramiko.SSHClient()
    SSH.set_missing_host_key_policy(paramiko.AutoAddPolicy())
except ImportError:
    raise Exception("ERROR: paramiko not installed")
try:
    SSH.connect(MAINHOST, username=USER, password=PASSWORD)
except paramiko.AuthenticationException:
    print("You have not added your SSH key to the lab machines (ssh-copy-id)")
    PASSWORD = getpass.getpass("password: ")
    try:
        SSH.connect(MAINHOST, username=USER, password=PASSWORD)
    except paramiko.AuthenticationException:
        raise Exception(
            "ERROR: Unable to logon")


def main():
    hosts = getHosts()
    hosts.pop('hosts.servers', None)  # we don't want redirect servers
    hosts.pop('hosts.printers', None)  # we don't want printer servers
    whoson = updateWhosOn(hosts)
    # print hosts


def getOutputFromMAINHOST(command):
    """
    returns output of command from the MAINHOST
    """
    stdin, stdout, stderr = SSH.exec_command(command)
    result = stdout.readlines()
    for i in range(len(result)):
        result[i] = result[i].strip().encode('ascii', 'ignore')
    return result


def getHosts():
    """
    from MAINHOST acquire the list of hosts and its computers from HOSTLOC
    """
    hostsList = []
    hostnames = getOutputFromMAINHOST("ls %s | grep hosts." % HOSTLOC)
    for hostname in hostnames:
        output = getOutputFromMAINHOST(
            "cat %s" % ("%s/%s" % (HOSTLOC, hostname)))
        hosts = []
        for host in output:
            if host[0] != "#":
                hosts.append(host)
        hostsList.append(hosts)
    allhosts = dict(zip(hostnames, hostsList))
    return allhosts


def updateWhosOn(hosts):
    """
    given dictionary of hosts with its corresponding computers, update hosts
    with users who are using the computers
    """
    for host in hosts.keys():
        print host
        getWhosOn(hosts[host])


def getWhosOn(hostList):
    """
    returns dictionary of who is on each computer given the list of hosts
    """
    hosts = ".cs.swarthmore.edu ".join(hostList) + ".cs.swarthmore.edu"
    try:
        tempOut = subprocess.check_output(
            # awk '{print $1 \" \" $5}' |
            "pssh -i -t 5 -x \"-o StrictHostKeyChecking=no\" -l %s -H \"%s\" \"%s\"" % (
                USER, hosts, "hostname && who"),
            stderr=subprocess.STDOUT,
            shell=True)
        out = ""
        for line in tempOut.strip().split("\n"):
            if line[0][0] != "[":
                out += line + "\n"
    except Exception as e:
        out = getWhosOnPer1(hostList)
    print out.strip() + "\n"


def getWhosOnPer1(hostList):
    """
    returns dictionary of who is on each computer given the list of hosts
    slower than getWhosOn because it is not multithreaded
    called when getWhosOn fails
    """
    hostStub = ".cs.swarthmore.edu"
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    returnString = ""

    for host in hostList:
        try:
            ssh.connect("%s%s" % (host, hostStub),
                        username=USER, password=PASSWORD, timeout=5.0)
            stdin, stdout, stderr = ssh.exec_command("hostname && who")
            result = stdout.readlines()
            for i in range(len(result)):
                result[i] = result[i].encode('ascii', 'ignore')
            for element in result:
                returnString += element
        except (socket.error, paramiko.ssh_exception.NoValidConnectionsError) as e:
            returnString += "*%s\n" % host
            returnString += "DOWN %s\n" % str(e)
        except paramiko.AuthenticationException:
            returnString += "*%s\n" % host
            returnString += "AUTHENTICATION ERROR\n"
        except Exception as e:
            raise Exception(e)
    return returnString


main()
