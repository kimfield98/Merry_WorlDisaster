"use client"
import React, { useState, useEffect, useRef } from 'react';
import {
  Viewer,
  Math,
  Cartesian3,
  Color,
  IonWorldImageryStyle,
  createWorldImageryAsync,
  CustomDataSource,
  ScreenSpaceEventHandler,
  defined,
  ScreenSpaceEventType,
  Ellipsoid,
  Entity,
  ConstantProperty,
  HeightReference,
  DirectionalLight,
  NearFarScalar,
  VerticalOrigin
} from 'cesium';
import { useRouter, useSearchParams } from 'next/navigation';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { dataState, DataType, filterState, mailAlarmState, PostAlertInfo, rightSidebarState, userLoginState, countryState, leftSidebarState, selectedDisasterIdState } from '../recoil/dataRecoil';
import axios from 'axios';
import Cookies from 'js-cookie';
import AlertModule from './socket/AlertModule';
import { selectedPinState } from '../recoil/dataRecoil';
import { any } from 'video.js/dist/types/utils/events';

//////// interface ////////
interface disasterInfoHover {
  dID: string;
  dType: string;
  dCountry: string;
  dStatus: string;
  dDate: string;
}

interface alertInfoHover {
  alertCountryName: string;
  alertRadius: number;
  alertlevelRed: boolean;
  alertlevelOrange: boolean;
  alertlevelGreen: boolean;
  createdAt: string;
}

interface AnimationState {
  stop: () => void;
  entity: Entity;
  originalSize: number;
}

const FilterStatusDisplay = () => {
  const dataFilter = useRecoilValue(filterState);

  const getFilterStatusText = () => {
    if (dataFilter.selectedLive) {
      return (
        <>
          <div style={{ backgroundColor: '#66ff00' }} className={`min-w-4 w-4 min-h-4 h-4 mx-2 rounded-full `}></div>
          <div>Live</div>
        </>
      );
    } else if (dataFilter.selectedYear) {
      return (
        <>
          <div style={{ backgroundColor: '#ff3300' }} className={`min-w-4 w-4 min-h-4 h-4 mx-2 rounded-full`}></div>
          <div>Archive-{dataFilter.selectedYear}</div>
        </>
      );
    } else {
      return null;
    }
  };
  return (
    <div className="absolute top-10 left-[100px] w-[200px]  rounded-2xl transform -translate-x-1/2 mt-4 text-center text-lg font-semibold z-10 p-2">
      <div className=" p-3 rounded-xl shadow-sm">
        <span className="text-white flex items-center">{getFilterStatusText()}</span>
      </div>
    </div>
  );
};

const EarthCesium = () => {
  const cesiumContainer = useRef(null);
  const router = useRouter();
  const search = useSearchParams();
  const viewerRef = useRef<Viewer | null>(null);
  const dataFilter = useRecoilValue(filterState);
  const [isUserInput, setIsUserInput] = useState(true);
  const [data, setData] = useRecoilState(dataState);
  const [countryData, setCountryData] = useRecoilState(countryState);
  const [dIdValue, setDIdValue] = useRecoilState(selectedDisasterIdState);
  const [custom, setCustom] = useState<CustomDataSource | null>(null);
  const [clickedEntity, setClickedEntity] = useState<Entity>();
  const [activeAnimation, setActiveAnimation] = useState<AnimationState | null>(null);
  const [showAlertTab, setShowAlertTab] = useState<boolean>(false);
  const [mailAlarmInfo, setMailAlarmInfo] = useRecoilState(mailAlarmState);
  const [alertData, setAlertData] = useState<PostAlertInfo[]>([]);
  const isLogin = useRecoilValue(userLoginState);
  const [rightSidebarOpen, setRightSidebarOpen] = useRecoilState(rightSidebarState);
  const [leftSidebarOpen, setLeftSidebarOpen] = useRecoilState(leftSidebarState);
  const setSelectedPinState = useSetRecoilState(selectedPinState);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // 재난 타입에 따른 색상 지정
  function getColorForDisasterType(type: any) {
    switch (type) {
      case "Tropical Cyclone":
        return "RED";
      case 'Mud Slide':
        return "BROWN";
      case 'Flash Flood':
        return "DARKBLUE";
      case 'Wild Fire':
        return "ORANGE";
      case 'Cold Wave':
        return "CYAN";
      case 'Technological Disaster':
        return "GRAY";
      case 'Snow Avalanche':
        return "LIGHTSKYBLUE";
      case 'Volcano':
        return "DARKRED";
      case 'Fire' && 'Forest Fire':
        return "FIREBRICK";
      case 'Epidemic':
        return "GREENYELLOW";
      case 'Storm Surge':
        return "STEELBLUE";
      case 'Tsunami':
        return "DEEPSKYBLUE";
      case 'Insect Infestation':
        return "OLIVE";
      case 'Drought':
        return "TAN";
      case 'Earthquake':
        return "SIENNA";
      case 'Flood':
        return "NAVY";
      case 'Land Slide':
        return "SADDLEBROWN";
      case 'Severe Local Storm':
        return "DARKSLATEGRAY";
      case 'Extratropical Cyclone':
        return "DARKORCHID";
      case 'Heat Wave':
        return "RED2";
      default:
        return "WHITE";
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && cesiumContainer.current) {
      let viewer = new Viewer(cesiumContainer.current, {
        animation: false, // 애니메이션 위젯 비활성화
        baseLayerPicker: false,// 베이스 레이어 선택기 비활성화
        fullscreenButton: false,// 전체 화면 버튼 비활성화
        vrButton: false,// VR 버튼 비활성화
        geocoder: true,// 지오코더 비활성화
        homeButton: true,// 홈 버튼 비활성화
        infoBox: false,// 정보 박스 비활성화
        sceneModePicker: false,// 장면 모드 선택기 비활성화
        selectionIndicator: false,// 선택 지시기 비활성화
        timeline: false,// 타임라인 비활성화
        navigationHelpButton: false,// 네비게이션 도움말 버튼 비활성화
        creditContainer: document.createElement("none"), // 스택오버플로우 참고
      });

      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 0; // 최소 확대 거리 (미터 단위)
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 30000000; // 최대 확대 거리 (미터 단위)
      viewer.scene.screenSpaceCameraController.enableTilt = false; // 휠클릭 회전 활성화 여부
      viewer.scene.screenSpaceCameraController.enableLook = false; // 우클릭 회전 활성화 여부
      viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK); // 더블클릭 이벤트 제거
      // viewer.scene.globe.maximumScreenSpaceError = 0; // 지형의 최대 화면 공간 오차 (픽셀 단위)
      viewer.scene.globe.enableLighting = false; // 조명 활성화 여부
      viewer.scene.light = new DirectionalLight({
        direction: Cartesian3.fromDegrees(1.0, 1.0, 1.0),
        intensity: 11,
      });

      // 초기 카메라 위치 설정
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(127.7703, 35.4634, 10000000), // 예: -117.16, 32.71, 15000
        orientation: {
          heading: Math.toRadians(20), // 동쪽
          pitch: Math.toRadians(-40), // 아래쪽으로 30도 기울기
          roll: 0 // 120도 회전
        }
      });

      // viewer 인스턴스 저장
      viewerRef.current = viewer;

      // layout 추가
      createWorldImageryAsync({
        style: IonWorldImageryStyle.AERIAL_WITH_LABELS,
      }).then((imageryProvider: any) => {
        viewer.scene.imageryLayers.addImageryProvider(imageryProvider);
        console.log(`Log: Layout loaded successfully.`)
      }).catch((err: Error) => {
        console.log(`Log: Failed to load layout: ${err}`);
      });

      // viewer 정리 로직 추가
      return () => {
        if (viewer && viewer.destroy) {
          viewer?.destroy();
        }
      }
    }
  }, []);

  //데이터 load로직
  const loadData = async () => {
    try {
      const [oldData, newData, cData] = await Promise.all([
        axios.get('https://worldisaster.com/api/oldDisasters'),
        axios.get('https://worldisaster.com/api/newDisasters'),
        axios.get('https://worldisaster.com/api/country'),
      ]);
      setCountryData(cData.data)
      setData(oldData.data.concat(newData.data));
      setCustom(new CustomDataSource('Disasters'));
      console.log(`Log: Data load successful.`);
    } catch (err) {
      console.log('Log: Data load failed.', err);
    }
  }

  const token = Cookies.get('access-token');

  const alertLoadData = async () => {
    if (!isLogin) return;
    try {
      const response = await axios('https://worldisaster.com/api/emailAlerts/',
        {
          headers: { Authorization: `Bearer ${token}` }
        });
      setAlertData(response.data);
      console.log("Log: Alert data load success.");
    } catch (err) {
      console.log('Log: Alert data load failed.', err);
    } finally {
      applyAlertData();
    }
  }

  // 알람핀을 유동
  const applyAlertData = () => {
    const viewer = viewerRef.current;
    if (!viewer || !custom) return;

    // 기존에 존재하는 'alert' 타입의 엔티티들을 찾아서 삭제
    const existingAlertEntities = custom.entities.values.filter(e => e.properties?.type._value !== 'disaster');
    existingAlertEntities.forEach(entity => custom.entities.remove(entity));

    // 새로운 'alertData'를 바탕으로 알람 엔티티들을 추가
    alertData.forEach(alert => {
      if (alert.alertLongitude && alert.alertLatitude) {
        const alertPointEntity = new Entity({
          position: Cartesian3.fromDegrees(alert.alertLongitude, alert.alertLatitude),
          point: {
            pixelSize: 10,
            color: Color.RED,
            outlineColor: Color.WHITE,
            outlineWidth: 2
          },
          properties: { ...alert, type: 'alert' }
        });

        const alertEllipseEntity = new Entity({
          position: Cartesian3.fromDegrees(alert.alertLongitude, alert.alertLatitude),
          ellipse: {
            semiMinorAxis: alert.alertRadius * 1000,
            semiMajorAxis: alert.alertRadius * 1000,
            height: 0,
            material: Color.RED.withAlpha(0.1),
            outline: true,
            outlineColor: Color.RED.withAlpha(0.5)
          }
        });

        custom.entities.add(alertPointEntity);
        custom.entities.add(alertEllipseEntity);
        console.log("Log: Alert data apply success.")
      }
    });
  }

  const applyFilters = () => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.camera) {
      return;
    }
    if (!custom) return;
    viewer.dataSources.add(custom);
    let filteredData = data

    if (dataFilter.selectedCountry !== "world") {
      filteredData = filteredData.filter((item: DataType) => item.dCountry === dataFilter.selectedCountry);
    }
    if (dataFilter.selectedDisaster && dataFilter.selectedDisaster.length > 0) {
      filteredData = filteredData.filter((item: DataType) => !dataFilter.selectedDisaster.includes(item.dType));
    }
    if (dataFilter.selectedYear) {
      filteredData = filteredData.filter((item: DataType) => new Date(item.dDate).getFullYear() === dataFilter.selectedYear);
    }
    if (dataFilter.selectedLive !== null) {
      filteredData = filteredData.filter((item: DataType) => (dataFilter.selectedLive ? item.dStatus !== "past" : item.dStatus === "past"));
    }

    custom.entities.removeAll();

    filteredData.forEach((item: DataType) => {
      if (item.dLongitude && item.dLatitude) {
        let entityToAdd;
        if (item.dStatus === 'ongoing' || item.dStatus === 'real-time') {
          item.dStatus === 'ongoing' ? (
            entityToAdd = new Entity({
              position: Cartesian3.fromDegrees(Number(item.dLongitude), Number(item.dLatitude), 0),
              point: {
                pixelSize: 10,
                heightReference: 0,
                color: Color.fromCssColorString("#FFA500"),
                outlineColor: Color.fromCssColorString("#ffffff"),
                outlineWidth: 1,
                scaleByDistance: new NearFarScalar(1e5, 2, 1e8, 0.01)
              },
              properties: { ...item, type: 'disaster' }
            })) : (
            entityToAdd = new Entity({
              position: Cartesian3.fromDegrees(Number(item.dLongitude), Number(item.dLatitude), 12),
              // model: {
              //   uri: `/pin.glb`,
              //   scale: 2,
              //   minimumPixelSize: 100,
              //   maximumScale: 1200000,
              //   heightReference: HeightReference.CLAMP_TO_GROUND,
              // },
              billboard: {
                image: `/pin.png`,
                scale: 0.1,
                heightReference: HeightReference.CLAMP_TO_GROUND,
                verticalOrigin: VerticalOrigin.BOTTOM,
              },
              properties: { ...item, type: 'disaster' }
            }))
        } else {
          entityToAdd = new Entity({
            position: Cartesian3.fromDegrees(Number(item.dLongitude), Number(item.dLatitude)),
            point: {
              pixelSize: 10,
              heightReference: 0,
              color: Color.fromCssColorString("#A0A0B0"),
              outlineColor: Color.fromCssColorString("#ffffff"),
              outlineWidth: 2,
              scaleByDistance: new NearFarScalar(1e5, 2, 1e8, 0.01)
            },
            properties: { ...item, type: 'disaster' }
          });
        }
        custom.entities.add(entityToAdd)
      }
    });
  }


  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    alertLoadData()
  }, [])

  useEffect(() => {
    if (alertData.length == 0) return;
    applyAlertData();

  }, [alertData]); // alertData가 변경될 때마다 핀 추가


  useEffect(() => {
    if (!custom || !viewerRef.current) return;
    alertLoadData()
  }, [mailAlarmInfo, dataFilter])

  useEffect(() => {
    alertLoadData()
  }, [mailAlarmInfo, dataFilter])

  useEffect(() => {
    if (!custom || !viewerRef.current) return;
    // custom.entities.removeAll();
    viewerRef.current.dataSources.remove(custom);
  }, [dataFilter])

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.camera) {
      return;
    }
    const customDataSource = new CustomDataSource('Disasters');
    viewer.dataSources.add(customDataSource);
  }, [dataFilter, data]);

  useEffect(() => {
    if (!custom || !viewerRef.current) return;
    applyFilters();
  }, [dataFilter, data])

  // 호버 이벤트 관리
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.camera) {
      return;
    }

    const tooltip = document.createElement('div') as HTMLDivElement;
    tooltip.style.display = 'none';
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'white';
    tooltip.style.border = '1px solid white';
    tooltip.style.borderRadius = '10px';
    tooltip.style.padding = '5px';
    tooltip.style.color = 'black';
    document.body.appendChild(tooltip);

    const tooltipContent = document.createElement('div') as HTMLDivElement;
    tooltipContent.style.display = 'none';
    tooltipContent.style.position = 'absolute';
    tooltipContent.style.backgroundColor = 'white';
    tooltipContent.style.border = '1px solid white';
    tooltipContent.style.borderRadius = '10px';
    tooltipContent.style.padding = '5px';
    tooltipContent.style.color = 'black';
    document.body.appendChild(tooltipContent);

    const tooltipLatLon = document.createElement('div');
    tooltipLatLon.style.display = 'none';
    tooltipLatLon.style.position = 'absolute';
    tooltipLatLon.style.backgroundColor = 'white';
    tooltipLatLon.style.border = '1px solid white';
    tooltipLatLon.style.borderRadius = '10px';
    tooltipLatLon.style.padding = '5px';
    tooltipLatLon.style.color = 'black';
    tooltipLatLon.style.left = '10px';
    tooltipLatLon.style.top = '10px';
    document.body.appendChild(tooltipLatLon);

    // 핸들러 모음
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    // 호버 이벤트에 사용되는 첫글자 대문자 함수
    const capitalizeFirstLetter = (string: string) => {
      if (!string) return '';
      return string.charAt(0).toUpperCase() + string.slice(1);
    };

    // 호버 이벤트
    handler.setInputAction((movement: any) => {
      const pickedObject = viewerRef.current?.scene.pick(movement.endPosition);
      if (defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
        const properties = pickedObject.id.properties;

        // 알림 데이터일 경우랑 재난일 경우 구분하기
        if (properties._type && properties._type._value === "alert") {
          const alertrData: alertInfoHover = {
            alertCountryName: properties._alertCountryName?._value,
            alertRadius: properties._alertRadius?._value,
            alertlevelRed: properties._alertLevelRed?._value,
            alertlevelOrange: properties._alertLevelOrange?._value,
            alertlevelGreen: properties._alertLevelGreen?._value,
            createdAt: properties._createdAt?._value,
          };
          tooltipContent.innerHTML = `
            <div style="
            background-color: rgba(255, 255, 255, 0.9); 
            border-radius: 8px; 
            padding: 10px; 
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            font-family: Arial, sans-serif;
            max-width: 200px;
            line-height: 1.4;
          ">
              <table style="padding:2px;">
                <tbody>
                  <tr>
                    <td style="color: #666;">Country :</td>
                    <td style="color: #000;">${alertrData.alertCountryName}</td>
                  </tr>
                  <tr>
                    <td style="color: #666;">Radius :</td>
                    <td style="color: #000;">${alertrData.alertRadius} km</td>
                  </tr>
                  <tr>
                    <td style="color: #666;">Alert Level :</td>
                    <td style="color: #000;">
                    <div style="display: flex; align-items: center; justify-content: center;">
                      <span style="margin: 10px; height: 10px; width: 10px; background-color: ${alertrData.alertlevelRed ? "red" : "gray"}; border-radius: 50%;"></span>
                      <span style="margin: 10px; height: 10px; width: 10px; background-color: ${alertrData.alertlevelOrange ? "orange" : "gray"}; border-radius: 50%;"></span>
                      <span style="margin: 10px; height: 10px; width: 10px; background-color: ${alertrData.alertlevelGreen ? "green" : "gray"}; border-radius: 50%;"></span>
                    </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>`;
          tooltipContent.style.display = 'block';
          tooltipContent.style.left = leftSidebarOpen.isOpen ? '566px' : '66px';
          tooltipContent.style.bottom = '0px';
          // 툴팁 위치 조정
        } else {
          tooltipContent.style.display = 'none';
        }
        if (properties._type && properties._type._value === "disaster") {

          const tDisasterData: disasterInfoHover = {
            dID: properties._dID?._value,
            dType: properties._dType?._value,
            dCountry: properties._dCountry?._value,
            dStatus: capitalizeFirstLetter(properties._dStatus?._value),
            dDate: properties._dDate?._value,
          };

          // <img src="./Disaster/${tDisasterData.dType}.png" alt="${tDisasterData.dType}" style="width: 36px; height: 36px; margin-bottom: 10px;">
          tooltip.innerHTML = `
          <div style="
          background-color: rgba(255, 255, 255, 0.9); 
          border-radius: 8px; 
          padding: 10px; 
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          font-family: Arial, sans-serif;
          max-width: 225px;
          line-height: 1.4;
        ">
              <img src="./Disaster/${tDisasterData.dType}.png" alt="${tDisasterData.dType}" style="width: 24px; height: 24px; position: absolute; top: 10px; right: 10px;">
              <table style="position: relative; z-index: 2;"> <!-- Ensure table is above the image -->
                <tbody>
                  <tr>
                    <td style="color: #666; padding-right: 8px;">Type: </td>
                    <td style="color: #000;">${tDisasterData.dType}</td>
                  </tr>
                  <tr>
                    <td style="color: #666; padding-right: 8px;">Country: </td>
                    <td style="color: #000;">${tDisasterData.dCountry}</td>
                  </tr>
                  <tr>
                    <td style="color: #666; padding-right: 8px;">Date: </td>
                    <td style="color: #000;">${tDisasterData.dDate}</td>
                  </tr>
                  <tr>
                    <td style="color: #666; padding-right: 8px;">Status: </td>
                    <td style="color: #000;">${tDisasterData.dStatus}</td>
                  </tr>
                </tbody>
              </table>
            </div>`;

          tooltip.style.display = 'block';
          tooltip.style.left = leftSidebarOpen.isOpen ? '566px' : '66px';
          tooltip.style.bottom = '0px'
          // 툴팁 위치 조정
        } else {
          tooltip.style.display = 'none';
        }
      } else {
        tooltip.style.display = 'none';
        tooltipContent.style.display = 'none';
        const ellipsoid = viewer.scene.globe.ellipsoid;
        const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
        if (cartesian) {
          // 위도와 경도 계산
          const cartographic = Ellipsoid.WGS84.cartesianToCartographic(cartesian);
          const longitude = Math.toDegrees(cartographic.longitude).toFixed(2);
          const latitude = Math.toDegrees(cartographic.latitude).toFixed(2);
          // Check if latitude is within the specified range
          const isLatitudeInRange = Number(latitude) >= -65 && Number(latitude) <= 70;

          // Update tooltipLatLon with conditional styling
          tooltipLatLon.innerHTML = `<div style="width: 300px; padding: 5px; textAlign: center;">Latitude: <span style="color: ${isLatitudeInRange ? 'black' : 'red'};">${latitude}°</span>, Longitude: ${longitude}°</div>`;
          tooltipLatLon.style.display = 'block';
          tooltipLatLon.style.left = rightSidebarOpen.isOpen ? String(window.innerWidth - tooltipLatLon.offsetWidth - 405) + 'px' : String(window.innerWidth - tooltipLatLon.offsetWidth - 5) + 'px';
          tooltipLatLon.style.top = String(window.innerHeight - tooltipLatLon.offsetHeight - 5) + 'px';
          tooltipLatLon.style.left = rightSidebarOpen.isOpen ? String(window.innerWidth - tooltipLatLon.offsetWidth - 405) + 'px' : String(window.innerWidth - tooltipLatLon.offsetWidth - 5) + 'px';
          tooltipLatLon.style.top = String(window.innerHeight - tooltipLatLon.offsetHeight - 5) + 'px';
        } else {
          tooltipLatLon.style.display = 'none';
          tooltip.style.display = 'none';
          tooltipContent.style.display = 'none';
        }
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // 캔버스에 mouseleave 이벤트 핸들러 추가
    const canvas = viewer.scene.canvas;
    const hideTooltips = () => {
      tooltip.style.display = 'none';
      tooltipContent.style.display = 'none';
      tooltipLatLon.style.display = 'none';
    };
    canvas.addEventListener('mouseleave', hideTooltips);

    return () => {
      handler.destroy();
    };
  }, [viewerRef.current, rightSidebarOpen, leftSidebarOpen]);

  // 우클릭 이벤트 관리
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.camera) {
      return;
    }

    // 핸들러 모음
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    // 우클릭 이벤트의 토글 확인용
    let lastAddedEntity: Entity | null = null;

    // 우클릭 이벤트
    handler.setInputAction((movement: any) => {
      if (isLogin.isLoggedIn === false) {
        alert('Please log-in to continue.');
        return
      };
      // 클릭한 스크린 좌표를 카르테시안 좌표로 변환
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        // 카르테시안 좌표를 위도와 경도로 변환
        const cartographic = Ellipsoid.WGS84.cartesianToCartographic(cartesian);
        const lon = Math.toDegrees(cartographic.longitude).toFixed(4);
        const lat = Math.toDegrees(cartographic.latitude).toFixed(4);
        if (Number(lat) < -65 || Number(lat) > 70 || Number(lon) < -180 || Number(lon) > 180) {
          alert("Alerts cannot be set for this area.\nPlease select another area.");
          return;
        }

        // 여기에 추가적인 로직을 구현할 수 있습니다, 예를 들어, UI 요소에 지역 이름을 표시
        setMailAlarmInfo({ ...mailAlarmInfo, alertLongitude: Number(lon), alertLatitude: Number(lat), open: true });
        setShowAlertTab(true);
        setLeftSidebarOpen({ isOpen: true, activeIcon: 'subscribe' });

        // 마지막으로 추가된 엔티티가 존재하면 삭제
        if (lastAddedEntity) {
          viewer.entities.remove(lastAddedEntity);
        }

        // 우클릭한 위치에 점 추가
        lastAddedEntity = viewer.entities.add({
          position: Cartesian3.fromDegrees(Number(lon), Number(lat)),
          point: {
            pixelSize: 10,
            color: Color.RED,
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            heightReference: 2,
          },
          ellipse: {
            semiMinorAxis: mailAlarmInfo.alertRadius * 1000,
            semiMajorAxis: mailAlarmInfo.alertRadius * 1000,
            height: 0,
            material: Color.RED.withAlpha(0.2),
            outline: true,
            outlineColor: new Color(255, 0, 0, 127),
          },
          id: String(mailAlarmInfo.objectId)
        });
      }
    }, ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [viewerRef.current]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.camera) {
      return;
    }

    const entityId = mailAlarmInfo.objectId;
    const entity = viewer.entities.getById(String(entityId));

    if (entity && entity.ellipse) {
      entity.ellipse.semiMinorAxis = new ConstantProperty(mailAlarmInfo.alertRadius * 1000);
      entity.ellipse.semiMajorAxis = new ConstantProperty(mailAlarmInfo.alertRadius * 1000);
    }

    if (entity && mailAlarmInfo.open == false) {
      viewer.entities.remove(entity);
    }

  }, [mailAlarmInfo])

  // 엔티티의 색상을 변경하는 함수
  const changeEntityColor = (entity: Entity) => {
    if (entity.point) {
      entity.point.outlineColor = new ConstantProperty(Color.YELLOW); // 색 변경
      entity.point.outlineWidth = new ConstantProperty(5);
    } else if (entity.ellipse) {
      entity.ellipse.outlineColor = new ConstantProperty(Color.YELLOW); // 색 변경
      entity.ellipse.outlineWidth = new ConstantProperty(5);
    }
  };

  // 엔티티의 색상을 원래대로 복원하는 함수
  const resetEntityColor = (entity: Entity) => {
    if (entity.point) {
      entity.point.outlineColor = new ConstantProperty(Color.WHITE); // 원래 색상으로 복원
      entity.point.outlineWidth = new ConstantProperty(1);
    } else if (entity.ellipse) {
      entity.ellipse.outlineColor = undefined; // 원래 색상으로 복원
      entity.ellipse.outlineWidth = undefined;
    }
  };

  const handleLeftClick = (entity: Entity) => {
    if (!entity || !entity.properties) return;

    // 이전 선택된 엔티티가 있으면 색상을 원래대로 복원
    if (selectedEntity && selectedEntity !== entity) {
      resetEntityColor(selectedEntity);
    }

    changeEntityColor(entity);
    setSelectedEntity(entity);



    const properties = entity.properties;
    if (properties._type && properties._type._value === "disaster") {
      const clickDisasterData = {
        dID: properties._dID?._value,
        dType: properties._dType?._value,
        dCountry: properties._dCountry?._value,
        dStatus: properties._dStatus?._value,
        dDate: properties._dDate?._value,
        dCountryLatitude: properties._dCountryLatitude?._value,
        dCountryLongitude: properties._dCountryLongitude?._value,
        dLatitude: properties._dLatitude?._value,
        dLongitude: properties._dLongitude?._value,
        objectId: properties._objectId?._value,
      };

      setSelectedPinState(clickDisasterData.dID);
      setDIdValue(clickDisasterData.dID);
      setLeftSidebarOpen({ isOpen: true, activeIcon: "detail" });
      setIsUserInput(true);
      setClickedEntity(entity);
    } else if (properties._type && properties._type._value === "alert") {
      const clickAlertData = {
        alertDistrictName: properties.alertDistrictName?._value,
        alertCountryName: properties._alertCountryName?._value,
        alertRadius: properties.alertRadius?._value,
        alertlevelRed: properties.alertLevelRed?._value,
        alertlevelOrange: properties.alertLevelOrange?._value,
        alertlevelGreen: properties.alertLevelGreen?._value,
        alertLatitude: properties.alertLatitude?._value,
        alertLongitude: properties.alertLongitude?._value,
        objectId: properties.objectId?._value,
        alertEmail: properties.alertEmail?._value,
        createdAt: properties.createAt?._value,
        memo: properties.memo?._value,
        open: true,
        edit: true,
        delete: false,
      };
      setLeftSidebarOpen({ isOpen: true, activeIcon: "subscribe" });
      setMailAlarmInfo(clickAlertData);
    }
  };

  // 좌클릭 이벤트 관리
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.camera) {
      return;
    }

    // 핸들러 모음
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    // 원클릭 이벤트
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
        if (pickedObject.id.properties._type && pickedObject.id.properties._type._value === "disaster") {
          const camaraHeight = Ellipsoid.WGS84.cartesianToCartographic(viewer.camera.position).height;
          router.push(`/earth?lon=${pickedObject.id.properties.dLongitude?._value}&lat=${pickedObject.id.properties._dLatitude?._value}&height=${camaraHeight}&did=${pickedObject.id.properties._dID?._value}`, undefined);
        } else {
          const camaraHeight = Ellipsoid.WGS84.cartesianToCartographic(viewer.camera.position).height;
          router.push(`/earth?lon=${pickedObject.id.properties.alertLongitude?._value}&lat=${pickedObject.id.properties.alertLatitude?._value}&height=${camaraHeight}`, undefined);
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };

  }, [viewerRef.current]);

  // 클릭된 엔티티 변경 감지
  useEffect(() => {
    if (clickedEntity) {
      if (activeAnimation) {
        activeAnimation.stop();
        if (activeAnimation.entity.point) {
          activeAnimation.entity.point.pixelSize = new ConstantProperty(activeAnimation.originalSize);
        }
      }
    }
  }, [clickedEntity]);

  // 애니메이션 상태 업데이트

  // 카메라 이동마다 이벤트 관리
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.scene || !viewer.camera) {
      return;
    };

    const moveEndListener = viewer.camera.moveEnd.addEventListener(() => {
      const cameraPosition = viewer.camera.positionCartographic;
      const longitude = Math.toDegrees(cameraPosition.longitude).toFixed(4);
      const latitude = Math.toDegrees(cameraPosition.latitude).toFixed(4);
      const cameraHeight = Ellipsoid.WGS84.cartesianToCartographic(viewer.camera.position).height;
      router.push(`/earth?lon=${longitude}&lat=${latitude}&height=${cameraHeight}`, undefined);
    });

    return () => {
      if (!isUserInput) {
        moveEndListener()
      }
    }

  }, [viewerRef.current?.camera, search.get('did')]);

  // url로 들어오는 경우 이벤트 관리
  useEffect(() => {
    const viewer = viewerRef.current;
    const lon = search.get('lon');
    const lat = search.get('lat');
    const zoomHeight = search.get('height');
    const detail = search.get('did');
    if (!viewer || !viewer.scene || !viewer.camera || !isUserInput) {
      return;
    };
    if (lon && lat && viewer && viewer.scene && viewer.camera) {
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon ? Number(lon) : 0, lat ? Number(lat) : 0, zoomHeight ? Number(zoomHeight) : 10e5),
        duration: 1,
        complete: () => {
          if (detail && custom) {
            setDIdValue(detail);
            // dID를 사용하여 Entity 찾기
            const entity = custom.entities.values.find(e => e.properties && e.properties._dID && e.properties._dID._value === detail);
            if (entity) {
              handleLeftClick(entity);
            }
          } else {
            const entity = custom?.entities.values.find(e =>
              e.properties &&
              e.properties._alertLatitude &&
              e.properties._alertLatitude._value === Number(lat) &&
              e.properties._alertLongitude &&
              e.properties._alertLongitude._value === Number(lon)
            );
            if (entity)
              handleLeftClick(entity);
          }
        }
      });
    }
  }, [viewerRef.current, search.get('lon'), search.get('lat'), search.get('height'), search.get('did')]);

  return (
    <>
      <div className='h-[100vh] pt-[50px]' ref={cesiumContainer}>
        <FilterStatusDisplay />
        <AlertModule />
      </div>
    </>
  );
};

export default EarthCesium;