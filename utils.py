
import numpy as np
import pandas as pd
import time
import datetime
import math
import os
import gzip
import json
import biosppy
from sklearn import preprocessing


def find_idx(data,low,high):
    indices = []
    for i in range(len(data)):
        if data[i] <= high and data[i] >= low:indices.append(i)
    return indices

def extract_timestamp(path):
    time_str = os.path.basename(os.path.dirname(path))
    dt = datetime.datetime.strptime(time_str,'%Y%m%dT%H%M%SZ')
    timestamp = dt.replace(tzinfo=datetime.timezone.utc).timestamp()
    return timestamp
    

def read_tobii_data(file_path):
    start_time = extract_timestamp(file_path)
    data = []
    with gzip.open(file_path,'r') as fin:        
        for line in fin:        
            tmp = str(line)[2:-3]
            obj = json.loads(tmp)
            data.append(obj)
    p_left = []
    p_right = []
    time_axis = []
    gaze2D_x=[]
    gaze2D_y = []
    for d in data:
        time_axis.append(d['timestamp']+start_time)
        
        if 'eyeleft' in d['data'] and "pupildiameter" in d['data']['eyeleft']:
            p_left.append(d["data"]["eyeleft"]["pupildiameter"])
        else:
            p_left.append(np.nan)
        
        if 'eyeright' in d['data'] and "pupildiameter" in d['data']['eyeright']:
            p_right.append(d["data"]["eyeright"]["pupildiameter"])
        else:
            p_right.append(np.nan)
         
        if 'gaze2d' in d['data']:
            gaze2D_x.append(d['data']['gaze2d'][0])
            gaze2D_y.append(d['data']['gaze2d'][1])
        else:
            gaze2D_x.append(np.nan)
            gaze2D_y.append(np.nan)
         
    df = pd.DataFrame(np.array([time_axis,p_left,p_right,gaze2D_x,gaze2D_y]).T,columns=["TIME","pLeft","pRight",'gazeX','gazeY'])
    return df

def smooth(x,window_len=11,window='hanning'):
    x = np.array(x)
    if x.ndim != 1:
        raise ValueError
    if x.size < window_len:
        raise ValueError
    if window_len<3:
        return x
    if not window in ['flat', 'hanning', 'hamming', 'bartlett', 'blackman']:
        raise ValueError
    
    s=np.r_[2*x[0]-x[window_len-1::-1],x,2*x[-1]-x[-1:-window_len:-1]]
    if window == 'flat': #moving average
        w=np.ones(window_len,'d')
    else:
        w=eval('np.'+window+'(window_len)')
    y=np.convolve(w/w.sum(),s,mode='same')
    return y[window_len:-window_len+1]



# ## for processing biosignals file
def _bio_header_process(file_path):
    f = open(file_path,"r")
    tmp = f.readlines()
    f.close()
    header = tmp[1][2:]
    header_data = json.loads(header)
    device = list(header_data.keys())[0]
    bio_channels = header_data[device]["sensor"]
    start_time_string = header_data[device]["date"] + " " + header_data[device]["time"].split(".")[0]
    start_time = datetime.datetime.timestamp(datetime.datetime.strptime(start_time_string,"%Y-%m-%d %H:%M:%S"))
    sampling_rate = header_data[device]["sampling rate"]
    bits=header_data[device]["resolution"]
    c = tmp[3]
    if " " in c and "\t" in c:
        delimiter=r'\s+'
    else:
        delimiter='\t'
    if not c[-2].isdigit():
        post_fix=["_1"]
    else:
        post_fix=[]
    return bio_channels, bits, start_time, sampling_rate,delimiter,post_fix


def read_plux_data(file_path):
    f = open(file_path,'r')
    header_lines = 3
    for i in range(header_lines):
        f.readline()
    temp_data = f.readlines()
    f.close()
    bio_channels, bits, bio_start_time, samplingrate,delimiter,post_fix = _bio_header_process(file_path)
    df=pd.read_csv(file_path,header=3,names=["TIME","_"]+bio_channels+post_fix,delimiter=delimiter)
    time_axis=[i/samplingrate + bio_start_time for i in range(len(df))]
    df["TIME"] = time_axis
    drops=["_"]+post_fix
    for drop in drops:
        df=df.drop([drop],axis=1)
    return df











