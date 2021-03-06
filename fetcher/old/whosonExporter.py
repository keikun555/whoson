"""
Kei Imada
20170425
Checks who's on on the lab.cs.swarthmore.edu network
Works if you have uploaded your ssh id to a lab computer with ssh-copy-id
"""
import getpass
import subprocess
import sys
import socket
import json
import time
from multiprocessing import pool, Lock

MAINHOST = "lab.cs.swarthmore.edu"
HOSTLOC = "/usr/swat/db"
USER = 'kimada1'

try:
    import paramiko
    SSH = paramiko.SSHClient()
    SSH.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    SSH.connect(MAINHOST, username=USER, password="")
except ImportError:
    raise Exception("ERROR: paramiko not installed")
except paramiko.AuthenticationException:
    raise Exception(
        "ERROR: You must add copy your key to the lab machines\nlook at ssh-copy-id")


def main():
    t1 = time.time()
    hosts = getHosts()
    hosts.pop('hosts.servers', None)  # we don't want redirect servers
    hosts.pop('hosts.printers', None)  # we don't want printer servers
    whoson = getMetaWhosOn(hosts, False)
    fout = open("../data/whoson.json", "w")
    json.dump(whoson, fout)
    fout.close()
    SSH.close()
    print("completed in %.2f seconds" % (time.time()-t1))
    # print hosts


def getOutputFromMAINHOST(command):
    """
    returns output of command from the MAINHOST as a list of lines
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


def getMetaWhosOn(hosts, printFLAG):
    """
    given dictionary of hosts with its corresponding computers, update hosts
    with users who are using the computers
    """
    threadPool = pool.ThreadPool(10)
    lock = Lock()
    returnDict = {}
    for host in hosts.keys():
        threadPool.apply_async(getWhosOn, (host, hosts[host], returnDict, lock, printFLAG))
    # for host in hosts.keys():
    #     returnDict[host] = returnDict[host].get()
    # threadPool.wait_completion()
    threadPool.close()
    threadPool.join()
    return returnDict


def getWhosOn(host, hostList, dictionary, lock, printFLAG):
    """
    returns dictionary of who is on each computer given the list of computers
    """
    hosts = ".cs.swarthmore.edu ".join(hostList) + ".cs.swarthmore.edu"
    try:
        tempOut = subprocess.check_output(
            # awk '{print $1 \" \" $5}' |
            "pssh -i -t 5 -x \"-o StrictHostKeyChecking=no\" -l %s -H \"%s\" \"%s\"" % (
                USER, hosts, "hostname && who -u && echo end"),
            stderr=subprocess.STDOUT,
            shell=True)
        out = ""
        for line in tempOut.strip().split("\n"):
            if line[0][0] != "[":
                out += line + "\n"
    except Exception as e:
        out = getWhosOnPer1(hostList)
    out = out.strip()
    if (printFLAG):
        lock.acquire()
        print(host)
        print(out)
        lock.release()
    dictionary[host] = parseUserData(out, hostList)


def getWhosOnPer1(hostList):
    """
    returns string of who is on each computer given the list of hosts
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
                        username=USER, password="", timeout=2.0)
            stdin, stdout, stderr = ssh.exec_command(
                "hostname && who -u && echo end")
            result = stdout.readlines()
            for i in range(len(result)):
                result[i] = result[i].encode('ascii', 'ignore')
            for element in result:
                returnString += element
        except (socket.error, paramiko.ssh_exception.NoValidConnectionsError) as e:
            returnString += "%s*\n" % host
            returnString += "DOWN %s\n" % str(e)
            returnString += "end\n"
        except paramiko.AuthenticationException:
            returnString += "%s*\n" % host
            returnString += "AUTHENTICATION ERROR\n"
            returnString += "end\n"
        except Exception as e:
            raise Exception(e)
    return returnString


def parseUserData(data, computerList):
    """
    given userdata in form of a string and list of computers it corresponds to, format into a dictionary and return it
    """
    data = data.strip().split("\n")
    data.reverse()
    returnDict = {}
    tempUserDict = {}
    cnames = []
    cList = computerList[:]

    while len(data) > 1:
        cname = data.pop()
        while(data[len(data) - 1] != "end"):
            line = data.pop().split()
            if(line[0] == "DOWN" or line[0] == "AUTHENTICATION"):
                tempUserDict = {"ERROR":" ".join(line)}
            else:
                user = {
                    "name": getOutputFromMAINHOST("finger -s %s | awk '{if(NR>1)print $2 \" \" $3}' | sort | uniq" % line[0])[0],
                    "login": line[0],
                    "line": line[1],
                    "date": line[2],
                    "time": line[3],
                    "idle": line[4],
                    "pid":  line[5],
                    "comment": line[6][1:len(line[6])-1]
                }
                if line[0] in tempUserDict:
                    tempUserDict[line[0]].append(user)
                else:
                    tempUserDict[line[0]]=[user]
        returnDict[cname] = tempUserDict
        tempUserDict = {}
        data.pop()
    return returnDict


main()
